// 获取飞机信息云函数
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
    const { serialNumber, aircraftId } = event;
    
    console.log('查询飞机信息参数:', event);
    
    // 验证参数 - 至少提供序列号或飞机ID中的一个
    if (!serialNumber && !aircraftId) {
      throw new Error('请提供有效的飞机序列号或飞机ID');
    }
    
    // 构建查询条件
    let queryCondition = {};
    
    if (serialNumber) {
      // 转换为大写以保持一致性
      const normalizedSerialNumber = serialNumber.toUpperCase();
      // 支持多种字段名称查询：registrationNumber 和 serialNumber
      // 使用或条件查询，同时支持两个字段
      queryCondition = _.or([
        { registrationNumber: normalizedSerialNumber },
        { serialNumber: normalizedSerialNumber }
      ]);
      
      // 添加不区分大小写的查询条件
      const lowerCaseSerialNumber = serialNumber.toLowerCase();
      queryCondition = _.or([
        { registrationNumber: normalizedSerialNumber },
        { serialNumber: normalizedSerialNumber },
        { registrationNumber: lowerCaseSerialNumber },
        { serialNumber: lowerCaseSerialNumber },
        { registrationNumber: serialNumber },
        { serialNumber: serialNumber }
      ]);
    }
    
    if (aircraftId) {
      queryCondition._id = aircraftId;
    }
    
    // 在aircrafts集合中查询飞机信息
    const queryResult = await db.collection('aircrafts')
      .where(queryCondition)
      .get();
    
    console.log('飞机信息查询结果:', queryResult);
    
    // 检查是否找到飞机信息
    if (queryResult.data.length === 0) {
      return {
        success: false,
        message: '未找到该飞机信息',
        aircraftInfo: null
      };
    }
    
    // 获取找到的飞机信息
    const aircraftInfo = queryResult.data[0];
    
    // 处理飞机型号，如果没有型号则使用默认型号
    if (!aircraftInfo.model) {
      aircraftInfo.model = 'DL-2L云雁';
    }
    
    // 简化状态显示，只显示"运营中"
    aircraftInfo.status = '运营中';
    
    // 如果飞机信息中有图片字段，获取图片下载链接
    if (aircraftInfo.image) {
      try {
        // 获取图片下载链接
        const fileInfo = await cloud.getTempFileURL({
          fileList: [aircraftInfo.image]
        });
        
        aircraftInfo.imageUrl = fileInfo.fileList[0].tempFileURL;
      } catch (imageError) {
        console.warn('获取图片下载链接失败:', imageError);
        // 如果获取图片链接失败，使用默认占位图
        aircraftInfo.imageUrl = '/images/aircraft-placeholder.png';
      }
    } else {
      // 如果没有图片，使用默认占位图
      aircraftInfo.imageUrl = '/images/aircraft-placeholder.png';
    }
    
    // 返回成功结果
    return {
      success: true,
      message: '获取飞机信息成功',
      aircraftInfo: aircraftInfo
    };
    
  } catch (error) {
    console.error('获取飞机信息失败', error);
    
    // 返回失败结果
    return {
      success: false,
      message: '获取飞机信息失败',
      error: error.message,
      aircraftInfo: null
    };
  }
};