// 上传飞机照片云函数
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 获取数据库引用
const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    // 获取传入的参数
    const { aircraftId, serialNumber, imageBase64, imageType = 'jpg' } = event;
    
    console.log('上传飞机照片参数:', { 
      aircraftId, 
      serialNumber, 
      hasImage: !!imageBase64, 
      imageType,
      imageBase64Length: imageBase64 ? imageBase64.length : 0
    });
    
    // 验证参数
    if (!aircraftId && !serialNumber) {
      return {
        success: false,
        message: '请提供飞机ID或序列号'
      };
    }
    
    if (!imageBase64) {
      return {
        success: false,
        message: '请提供图片数据'
      };
    }
    
    let aircraft;
    
    // 如果提供了aircraftId，直接通过ID查询
    if (aircraftId) {
      try {
        const aircraftDoc = await db.collection('aircrafts').doc(aircraftId).get();
        aircraft = aircraftDoc.data;
        console.log('通过ID找到飞机:', aircraft);
      } catch (error) {
        console.error('通过ID查询飞机失败:', error);
        return {
          success: false,
          message: '未找到该飞机信息'
        };
      }
    } else {
      // 否则通过序列号查询
      try {
        const aircraftQuery = await db.collection('aircrafts')
          .where({
            serialNumber: serialNumber.toUpperCase()
          })
          .get();
        
        console.log('通过序列号查询结果:', aircraftQuery.data);
        
        // 检查是否找到飞机信息
        if (aircraftQuery.data.length === 0) {
          return {
            success: false,
            message: '未找到该飞机信息，请先绑定飞机'
          };
        }
        
        aircraft = aircraftQuery.data[0];
      } catch (error) {
        console.error('通过序列号查询飞机失败:', error);
        return {
          success: false,
          message: '查询飞机信息失败'
        };
      }
    }
    
    // 构建云存储文件路径
    const finalSerialNumber = aircraft.serialNumber || serialNumber;
    const cloudPath = `aircraft-images/${finalSerialNumber}.${imageType}`;
    
    console.log('准备上传图片到云存储:', cloudPath);
    
    // 将base64图片数据转换为buffer
    let base64Data = imageBase64;
    
    // 检查是否包含data URL前缀，如果有则移除
    if (imageBase64.startsWith('data:image/')) {
      base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    }
    
    console.log('Base64数据处理后长度:', base64Data.length);
    
    // 验证base64数据
    if (!base64Data || base64Data.length === 0) {
      return {
        success: false,
        message: '图片数据为空'
      };
    }
    
    // 验证base64格式有效性
    try {
      // 检查base64字符串长度是否为4的倍数
      if (base64Data.length % 4 !== 0) {
        console.warn('Base64数据长度不是4的倍数，可能不完整');
        return {
          success: false,
          message: 'Base64数据格式不正确，请重新选择图片'
        };
      }
      
      // 检查是否包含有效的base64字符
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(base64Data)) {
        return {
          success: false,
          message: 'Base64数据包含无效字符，请确保图片完整'
        };
      }
      
      // 创建buffer用于验证，但不用于上传（上传时会重新创建）
      const validationBuffer = Buffer.from(base64Data, 'base64');
      console.log('验证Buffer成功，大小:', validationBuffer.length);
      
      // 检查文件大小合理性（1KB-10MB）
      if (validationBuffer.length < 1024) {
        return {
          success: false,
          message: `图片数据过小(${validationBuffer.length}字节)，请选择大于1KB的有效图片`
        };
      } else if (validationBuffer.length > 10 * 1024 * 1024) {
        return {
          success: false,
          message: `图片过大(${(validationBuffer.length/1024/1024).toFixed(2)}MB)，请选择小于10MB的图片`
        };
      }
      
      // 验证图片头信息
      if (validationBuffer.length < 8) {
        return {
          success: false,
          message: '图片文件头信息不完整，可能文件已损坏'
        };
      }
      
      const header = validationBuffer.subarray(0, 12); // 读取更多字节以支持WEBP检测
      const headerHex = header.toString('hex');
      console.log('图片文件头:', headerHex);
      
      // 检查常见图片格式头
      const validHeaders = {
        'ffd8ffe0': 'JPEG', // JPEG
        'ffd8ffe1': 'JPEG', // JPEG
        'ffd8ffe8': 'JPEG', // JPEG SPIFF
        '89504e47': 'PNG',  // PNG
        '47494638': 'GIF',  // GIF
        '52494646': 'WEBP' // WEBP (RIFF)
      };
      
      let detectedType = null;
      
      // 检测JPEG
      if (headerHex.toLowerCase().startsWith('ffd8')) {
        detectedType = 'JPEG';
      }
      // 检测PNG
      else if (headerHex.toLowerCase().startsWith('89504e47')) {
        detectedType = 'PNG';
      }
      // 检测GIF
      else if (headerHex.toLowerCase().startsWith('47494638')) {
        detectedType = 'GIF';
      }
      // 检测WEBP (需要检查RIFF头和WEBP标识)
      else if (headerHex.toLowerCase().startsWith('52494646') && 
               header.length >= 12 && 
               header.subarray(8, 12).toString('ascii') === 'WEBP') {
        detectedType = 'WEBP';
      }
      
      if (!detectedType) {
        return {
          success: false,
          message: '不支持的图片格式或文件已损坏，请使用JPEG、PNG、GIF或WEBP格式'
        };
      }
      
      console.log('检测到图片格式:', detectedType);
      
      // 额外的图片完整性检查
      if (detectedType === 'JPEG') {
        // 检查JPEG文件结尾是否有EOI标记
        if (validationBuffer.length >= 2) {
          const endMarker = validationBuffer.subarray(validationBuffer.length - 2);
          if (endMarker[0] !== 0xFF || endMarker[1] !== 0xD9) {
            console.warn('JPEG文件缺少结束标记，可能不完整');
          }
        }
      } else if (detectedType === 'PNG') {
        // 检查PNG文件结尾是否有IEND块
        if (validationBuffer.length >= 8) {
          const endMarker = validationBuffer.subarray(validationBuffer.length - 8);
          const endHex = endMarker.toString('hex');
          if (endHex.toLowerCase() !== '0000000049454e44') {
            console.warn('PNG文件缺少IEND块，可能不完整');
          }
        }
      }
      
    } catch (bufferError) {
      console.error('图片数据验证失败:', bufferError);
      return {
        success: false,
        message: '图片数据格式错误: ' + bufferError.message
      };
    }
    
    // 上传图片到云存储
    let uploadResult;
    let buffer; // 将buffer声明移到外部作用域
    try {
      // 重新创建buffer，确保在正确的作用域内
      buffer = Buffer.from(base64Data, 'base64');
      
      uploadResult = await cloud.uploadFile({
        cloudPath: cloudPath,
        fileContent: buffer
      });
      console.log('图片上传成功:', uploadResult);
    } catch (uploadError) {
      console.error('上传到云存储失败:', uploadError);
      
      // 根据错误类型提供更具体的错误信息
      let errorMessage = '上传失败';
      if (uploadError.errCode === -601) {
        errorMessage = '文件类型不支持，请上传有效的图片文件';
      } else if (uploadError.errCode === -602) {
        errorMessage = '文件过大，请选择较小的图片文件';
      } else if (uploadError.errCode === -501) {
        errorMessage = '网络连接失败，请检查网络后重试';
      } else {
        errorMessage = '上传失败: ' + (uploadError.message || '未知错误');
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
    
    // 获取图片下载链接
    let imageUrl = '';
    try {
      const fileInfo = await cloud.getTempFileURL({
        fileList: [uploadResult.fileID]
      });
      
      if (fileInfo.fileList && fileInfo.fileList.length > 0) {
        const fileItem = fileInfo.fileList[0];
        if (fileItem.tempFileURL) {
          imageUrl = fileItem.tempFileURL;
          console.log('获取图片链接成功:', imageUrl);
        } else if (fileItem.errCode === -1) {
          console.warn('获取临时链接失败，文件可能不存在');
          return {
            success: false,
            message: '获取图片链接失败，文件可能不存在'
          };
        } else {
          console.warn('获取临时链接失败:', fileItem.errMsg);
          return {
            success: false,
            message: '获取图片链接失败: ' + (fileItem.errMsg || '未知错误')
          };
        }
      }
    } catch (urlError) {
      console.error('获取图片链接失败:', urlError);
      return {
        success: false,
        message: '获取图片链接失败: ' + (urlError.message || '未知错误')
      };
    }
    
    // 更新飞机信息中的图片字段
    const updateData = {
      image: uploadResult.fileID,
      imageUploaded: true,
      updateTime: new Date()
    };
    
    // 只有成功获取到临时链接才保存url字段
    if (imageUrl) {
      updateData.imageUrl = imageUrl;
    }
    
    let updateResult;
    try {
      updateResult = await db.collection('aircrafts')
        .doc(aircraft._id)
        .update({
          data: updateData
        });
      console.log('更新飞机信息成功:', updateResult);
    } catch (updateError) {
      console.error('更新飞机信息失败:', updateError);
      // 即使数据库更新失败，也返回上传成功的信息，因为文件已经上传成功
      console.warn('文件已上传但数据库更新失败，请手动处理');
      return {
        success: false,
        message: '图片上传成功但保存信息失败，请联系管理员'
      };
    }
    
    // 返回成功结果
    return {
      success: true,
      message: '飞机照片上传成功',
      data: {
        fileId: uploadResult.fileID,
        imageUrl: imageUrl,
        cloudPath: cloudPath
      }
    };
    
  } catch (error) {
    console.error('上传飞机照片失败', error);
    
    // 返回失败结果
    return {
      success: false,
      message: '上传飞机照片失败: ' + error.message,
      error: error.message
    };
  }
};