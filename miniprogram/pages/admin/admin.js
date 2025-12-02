// pages/admin/admin.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    aircraftData: {
      serialNumber: '',
      registrationNumber: '',
      yearOfManufacture: '',
      status: 'active'
    },
    aircraftImageSrc: '',
    canSubmit: false,
    submitting: false,
    aircraftList: [],
    // 编辑相关数据
    showEditModal: false,
    editAircraftData: {
      id: '',
      serialNumber: '',
      registrationNumber: '',
      yearOfManufacture: '',
      status: '',
      image: ''
    },
    editImageSrc: '',
    editSubmitting: false,
    canEditSubmit: false, // 添加编辑表单是否可以提交的状态
    boundCount: 0
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    console.log('admin页面加载...');
    console.log('页面加载时的aircraftList:', this.data.aircraftList);
    console.log('页面加载时的aircraftList长度:', this.data.aircraftList.length);
    
    // 初始化加载状态
    this.setData({
      isLoadingAircraftList: false
    });
    
    // 加载飞机列表
    this.loadAircraftList();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    console.log('admin页面初次渲染完成...');
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    console.log('admin页面显示...');
    
    // 如果正在加载数据，跳过重复加载
    if (this.data.isLoadingAircraftList) {
      console.log('飞机列表正在加载中，跳过重复加载');
      return;
    }
    
    // 如果已经有飞机列表数据，跳过重复加载（管理页面需要实时数据，但避免重复调用）
    if (this.data.aircraftList && this.data.aircraftList.length > 0) {
      console.log('已有飞机列表数据，跳过重复加载');
      return;
    }
    
    // admin页面是管理页面，直接调用云函数获取实时数据
    console.log('admin页面直接调用云函数获取实时飞机列表数据');
    this.loadAircraftList();
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    console.log('下拉刷新...');
    this.loadAircraftList();
    // 停止下拉刷新
    wx.stopPullDownRefresh();
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {

  },

  // 输入飞机信息
  onAircraftInput: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const aircraftData = this.data.aircraftData;
    aircraftData[field] = value;
    
    this.setData({
      aircraftData: aircraftData
    });
    
    // 检查是否可以提交
    this.checkCanSubmit();
  },

  // 选择飞机图片
  chooseAircraftImage: function() {
    console.log('开始选择飞机图片');
    
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'], // 使用压缩图片
      sourceType: ['album', 'camera'],
      success: (res) => {
        console.log('选择图片成功:', res);
        
        // 验证图片路径
        if (!res.tempFilePaths || res.tempFilePaths.length === 0) {
          console.error('选择图片失败: 未返回有效路径');
          wx.showToast({
            title: '选择图片失败',
            icon: 'none'
          });
          return;
        }
        
        const imagePath = res.tempFilePaths[0];
        console.log('临时文件路径:', imagePath);
        
        // 获取图片信息，检查大小
        wx.getImageInfo({
          src: imagePath,
          success: (imgInfo) => {
            console.log('图片信息:', imgInfo);
            
            // 检查图片大小（转换为MB）
            const sizeInMB = imgInfo.size / (1024 * 1024);
            if (sizeInMB > 8) { // 留一些余量，设置为8MB
              wx.showModal({
                title: '图片过大',
                content: `图片大小为${sizeInMB.toFixed(2)}MB，超过8MB限制。请选择较小的图片或使用相册中的压缩功能。`,
                showCancel: false,
                confirmText: '知道了'
              });
              return;
            }
            
            // 检查图片尺寸，如果过大则进行压缩
            if (imgInfo.width > 2000 || imgInfo.height > 2000) {
              console.log('图片尺寸过大，进行压缩');
              this.compressImage(imagePath, imgInfo);
            } else {
              // 图片尺寸合适，直接使用
              this.setData({
                aircraftImageSrc: imagePath
              });
              console.log('图片路径已设置:', this.data.aircraftImageSrc);
              
              // 检查是否可以提交
              this.checkCanSubmit();
            }
          },
          fail: (err) => {
            console.error('获取图片信息失败:', err);
            // 即使获取信息失败，也尝试使用图片
            this.setData({
              aircraftImageSrc: imagePath
            });
            console.log('图片路径已设置（获取信息失败）:', this.data.aircraftImageSrc);
            
            // 检查是否可以提交
            this.checkCanSubmit();
          }
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 压缩图片（使用Canvas 2D）
  compressImage: function(imagePath, imgInfo) {
    console.log('开始压缩图片，原始尺寸:', imgInfo.width, 'x', imgInfo.height);
    
    // 计算压缩比例
    const maxWidth = 1920;
    const maxHeight = 1920;
    let width = imgInfo.width;
    let height = imgInfo.height;
    
    // 计算缩放比例
    if (width > maxWidth) {
      height = Math.round(height * (maxWidth / width));
      width = maxWidth;
    }
    
    if (height > maxHeight) {
      width = Math.round(width * (maxHeight / height));
      height = maxHeight;
    }
    
    console.log('压缩后尺寸:', width, 'x', height);
    
    // 使用Canvas 2D压缩图片
    const query = wx.createSelectorQuery();
    query.select('#compressCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res[0].node;
        const ctx = canvas.getContext('2d');
        
        // 设置canvas尺寸
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        
        // 创建图片对象
        const image = canvas.createImage();
        image.onload = () => {
          // 绘制图片
          ctx.drawImage(image, 0, 0, width, height);
          
          // 导出压缩后的图片
          wx.canvasToTempFilePath({
            canvas: canvas,
            x: 0,
            y: 0,
            width: width,
            height: height,
            destWidth: width,
            destHeight: height,
            quality: 0.8, // 压缩质量为0.8
            success: (res) => {
              console.log('图片压缩成功:', res.tempFilePath);
              
              // 更新图片路径
              this.setData({
                aircraftImageSrc: res.tempFilePath
              });
              
              // 检查是否可以提交
              this.checkCanSubmit();
            },
            fail: (err) => {
              console.error('图片压缩失败:', err);
              
              // 压缩失败，使用原图
              this.setData({
                aircraftImageSrc: imagePath
              });
              
              // 检查是否可以提交
              this.checkCanSubmit();
            }
          });
        };
        
        image.onerror = (err) => {
          console.error('图片加载失败:', err);
          
          // 图片加载失败，使用原图
          this.setData({
            aircraftImageSrc: imagePath
          });
          
          // 检查是否可以提交
          this.checkCanSubmit();
        };
        
        image.src = imagePath;
      });
  },

  // 检查是否可以提交
  checkCanSubmit: function() {
    const { serialNumber, yearOfManufacture } = this.data.aircraftData;
    const { aircraftImageSrc } = this.data;
    
    const canSubmit = serialNumber.trim() !== '' && 
                     yearOfManufacture.toString().trim() !== '' && 
                     aircraftImageSrc !== '';
    
    this.setData({
      canSubmit: canSubmit
    });
  },

  // 添加飞机
  addAircraft: function() {
    if (!this.data.canSubmit) {
      return;
    }

    console.log('开始添加飞机:', this.data.aircraftData);
    this.setData({
      submitting: true
    });

    // 先调用addAircraft云函数添加飞机信息
    wx.cloud.callFunction({
      name: 'addAircraft',
      data: this.data.aircraftData,
      success: (addRes) => {
        console.log('添加飞机结果:', addRes.result);
        if (addRes.result.success) {
          // 飞机信息添加成功，再上传图片
          this.uploadAircraftImage(addRes.result.aircraftId);
        } else {
          wx.showToast({
            title: addRes.result.message || '添加飞机失败',
            icon: 'none'
          });
          this.setData({
            submitting: false
          });
        }
      },
      fail: (err) => {
        console.error('添加飞机失败:', err);
        wx.showToast({
          title: '添加飞机失败',
          icon: 'none'
        });
        this.setData({
          submitting: false
        });
      }
    });
  },

  // 上传飞机图片
  uploadAircraftImage: function(aircraftId) {
    console.log('开始上传飞机图片, 图片路径:', this.data.aircraftImageSrc);
    
    // 验证图片路径
    if (!this.data.aircraftImageSrc) {
      console.error('图片路径为空');
      wx.showToast({
        title: '飞机信息已添加，图片路径为空',
        icon: 'none'
      });
      this.resetFormAndRefresh();
      return;
    }
    
    // 显示上传进度
    wx.showLoading({
      title: '上传图片中...',
      mask: true
    });
    
    // 将本地图片转换为base64，增加重试机制
    this.readImageWithRetry(aircraftId, this.data.aircraftData.serialNumber, 0);
  },
  
  // 带重试机制的图片读取
  readImageWithRetry: function(aircraftId, serialNumber, retryCount) {
    const maxRetries = 3;
    const fileSystemManager = wx.getFileSystemManager();
    
    // 在真机上，先尝试使用readFileSync，如果失败再使用异步方式
    try {
      console.log(`尝试同步读取图片文件 (第${retryCount + 1}次)`);
      const imageData = fileSystemManager.readFileSync(this.data.aircraftImageSrc, 'base64');
      console.log('同步读取图片成功，数据长度:', imageData.length);
      
      // 处理图片数据
      this.processImageData(imageData, aircraftId, serialNumber);
    } catch (syncError) {
      console.warn(`同步读取图片失败 (第${retryCount + 1}次):`, syncError);
      
      // 同步读取失败，使用异步方式
      fileSystemManager.readFile({
        filePath: this.data.aircraftImageSrc,
        encoding: 'base64',
        success: (res) => {
          console.log('异步读取图片成功，数据长度:', res.data.length);
          
          // 处理图片数据
          this.processImageData(res.data, aircraftId, serialNumber);
        },
        fail: (err) => {
          console.error(`异步读取图片也失败 (第${retryCount + 1}次):`, err);
          
          // 重试机制
          if (retryCount < maxRetries - 1) {
            console.log(`将在1秒后进行第${retryCount + 2}次重试...`);
            setTimeout(() => {
              this.readImageWithRetry(aircraftId, serialNumber, retryCount + 1);
            }, 1000);
          } else {
            console.error('已达到最大重试次数，放弃读取图片');
            this.handleImageReadError(err);
          }
        }
      });
    }
  },
  
  // 处理图片数据
  processImageData: function(imageData, aircraftId, serialNumber) {
    // 验证图片数据
    if (!imageData || imageData.length === 0) {
      console.error('图片数据为空');
      wx.showToast({
        title: '飞机信息已添加，图片数据为空',
        icon: 'none'
      });
      this.resetFormAndRefresh();
      return;
    }
    
    // 获取图片类型 - 增强兼容性处理
    let imageType = 'jpg'; // 默认类型
    
    // 尝试从文件路径获取扩展名
    const filePath = this.data.aircraftImageSrc;
    if (filePath && filePath.includes('.')) {
      const ext = filePath.split('.').pop().toLowerCase();
      // 验证是否是有效的图片类型
      if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) {
        imageType = ext;
      }
    }
    
    console.log('使用图片类型:', imageType);
    
    // 构建base64图片数据
    const imageBase64 = `data:image/${imageType};base64,${imageData}`;
    console.log('Base64图片数据长度:', imageBase64.length);
    
    // 调用uploadAircraftImage云函数上传图片
    wx.cloud.callFunction({
      name: 'uploadAircraftImage',
      data: {
        aircraftId: aircraftId,
        serialNumber: serialNumber,
        imageBase64: imageBase64,
        imageType: imageType
      },
      success: (uploadRes) => {
        console.log('上传图片云函数调用成功:', uploadRes);
        if (uploadRes.result && uploadRes.result.success) {
          wx.showToast({
            title: '飞机添加成功',
            icon: 'success'
          });
        } else {
          console.error('上传图片失败，云函数返回:', uploadRes);
          const errorMsg = uploadRes.result && uploadRes.result.message ? 
            uploadRes.result.message : '图片上传失败';
          wx.showToast({
            title: `飞机信息已添加，${errorMsg}`,
            icon: 'none',
            duration: 3000
          });
        }
        
        // 无论图片是否上传成功，都清空表单并刷新列表
        this.resetFormAndRefresh();
      },
      fail: (err) => {
        console.error('上传图片失败:', err);
        wx.showToast({
          title: '飞机信息已添加，图片上传失败',
          icon: 'none',
          duration: 3000
        });
        
        // 即使图片上传失败，也清空表单并刷新列表
        this.resetFormAndRefresh();
      }
    });
  },
  
  // 处理图片读取错误
  handleImageReadError: function(err) {
    console.error('读取图片失败:', err);
    let errorMsg = '图片读取失败';
    
    // 根据错误码提供更具体的错误信息
    if (err.errMsg && err.errMsg.includes('no such file or directory')) {
      errorMsg = '图片文件不存在';
    } else if (err.errMsg && err.errMsg.includes('permission denied')) {
      errorMsg = '没有读取图片权限';
    } else if (err.errMsg && err.errMsg.includes('file not exist')) {
      errorMsg = '图片文件不存在，请重新选择';
    }
    
    wx.showToast({
      title: `飞机信息已添加，${errorMsg}`,
      icon: 'none',
      duration: 3000
    });
    
    // 即使图片读取失败，也清空表单并刷新列表
    this.resetFormAndRefresh();
  },

  // 重置表单并刷新列表
  resetFormAndRefresh: function() {
    console.log('重置表单并刷新列表...');
    console.log('重置前aircraftList:', this.data.aircraftList);
    console.log('重置前aircraftList长度:', this.data.aircraftList.length);
    console.log('重置前aircraftData:', this.data.aircraftData);
    console.log('重置前aircraftImageSrc:', this.data.aircraftImageSrc);
    
    // 清空表单
    this.setData({
      aircraftData: {
        serialNumber: '',
        registrationNumber: '',
        yearOfManufacture: '',
        status: 'active'
      },
      aircraftImageSrc: '',
      canSubmit: false,
      submitting: false
    });
    
    console.log('表单已重置，准备刷新飞机列表...');
    console.log('重置后aircraftList:', this.data.aircraftList);
    console.log('重置后aircraftList长度:', this.data.aircraftList.length);
    console.log('重置后aircraftData:', this.data.aircraftData);
    console.log('重置后aircraftImageSrc:', this.data.aircraftImageSrc);
    
    // 刷新飞机列表
    this.loadAircraftList();
  },

  // 加载飞机列表
  loadAircraftList: function(forceRefresh = false) {
    console.log('开始加载飞机列表...');
    console.log('当前aircraftList:', this.data.aircraftList);
    console.log('当前aircraftList长度:', this.data.aircraftList.length);
    
    // 检查是否正在加载，避免重复调用
    if (this.data.isLoadingAircraftList) {
      console.log('飞机列表正在加载中，跳过重复调用');
      return;
    }
    
    // 设置加载状态
    this.setData({
      isLoadingAircraftList: true
    });
    
    // admin页面直接调用云函数获取实时数据，不依赖全局数据
    wx.cloud.callFunction({
      name: 'getAllAircraftList',
      success: (res) => {
        console.log('获取飞机列表成功:', res.result);
        if (res.result.success) {
          console.log('飞机列表数据:', res.result.aircraftList);
          console.log('飞机列表长度:', res.result.aircraftList.length);
          
          // 为每个飞机添加状态类名
          const aircraftListWithStatusClass = res.result.aircraftList.map(aircraft => {
            return {
              ...aircraft,
              statusClass: 'normal'
            };
          });
          
          // 计算已绑定的飞机数量
          const boundCount = res.result.aircraftList.filter(aircraft => aircraft.isBound).length;
          
          this.setData({
            aircraftList: aircraftListWithStatusClass,
            boundCount: boundCount,
            isLoadingAircraftList: false
          });
          
          console.log('setData后的aircraftList:', this.data.aircraftList);
          console.log('setData后的aircraftList长度:', this.data.aircraftList.length);
        } else {
          console.error('获取飞机列表失败:', res.result.message);
          
          // 加载失败时重置状态
          this.setData({
            isLoadingAircraftList: false
          });
        }
      },
      fail: (err) => {
        console.error('调用云函数失败:', err);
        
        // 加载失败时重置状态
        this.setData({
          isLoadingAircraftList: false
        });
      }
    });
  },

  // 检查编辑表单是否可以提交
  checkCanEditSubmit: function() {
    const { editAircraftData } = this.data;
    const canEditSubmit = editAircraftData.serialNumber.trim() !== '' && 
                         editAircraftData.yearOfManufacture.trim() !== '';
    
    this.setData({
      canEditSubmit: canEditSubmit
    });
  },

  // 编辑飞机
  editAircraft: function(e) {
    const { id, index } = e.currentTarget.dataset;
    const aircraft = this.data.aircraftList[index];
    
    this.setData({
      showEditModal: true,
      editAircraftData: {
        id: aircraft.id,
        serialNumber: aircraft.serialNumber,
        registrationNumber: aircraft.registrationNumber || '',
        yearOfManufacture: aircraft.yearOfManufacture,
        status: '正常',
        statusClass: 'normal',
        image: aircraft.image
      },
      editImageSrc: aircraft.image
    });
    
    // 初始化编辑表单的提交状态
    this.checkCanEditSubmit();
  },

  // 关闭编辑弹窗
  closeEditModal: function() {
    this.setData({
      showEditModal: false,
      editAircraftData: {
        id: '',
        serialNumber: '',
        registrationNumber: '',
        yearOfManufacture: '',
        status: '',
        image: ''
      },
      editImageSrc: ''
    });
  },

  // 编辑表单输入
  onEditInput: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    this.setData({
      [`editAircraftData.${field}`]: value
    });
    
    // 检查编辑表单是否可以提交
    this.checkCanEditSubmit();
  },



  // 阻止事件冒泡
  preventProp: function() {
    return;
  },

  // 选择编辑图片
  chooseEditImage: function() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      maxDuration: 30,
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        this.setData({
          editImageSrc: tempFilePath,
          'editAircraftData.image': tempFilePath
        });
      },
      fail: (err) => {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 确认编辑
  confirmEdit: function() {
    if (!this.data.canEditSubmit) {
      wx.showToast({
        title: '请填写必要信息',
        icon: 'none'
      });
      return;
    }

    this.setData({ editSubmitting: true });
    
    // 准备更新数据
    const updateData = {
      id: this.data.editAircraftData.id,
      serialNumber: this.data.editAircraftData.serialNumber,
      registrationNumber: this.data.editAircraftData.registrationNumber,
      yearOfManufacture: this.data.editAircraftData.yearOfManufacture,
      status: this.data.editAircraftData.status
    };

    // 如果有新图片，先上传图片
    if (this.data.editImageSrc !== this.data.aircraftList.find(a => a.id === this.data.editAircraftData.id).image) {
      this.uploadEditImage(updateData);
    } else {
      this.updateAircraftInfo(updateData);
    }
  },

  // 上传编辑图片
  uploadEditImage: function(updateData) {
    wx.cloud.uploadFile({
      cloudPath: `aircraft/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`,
      filePath: this.data.editImageSrc,
      success: (res) => {
        updateData.image = res.fileID;
        this.updateAircraftInfo(updateData);
      },
      fail: (err) => {
        console.error('上传图片失败:', err);
        this.setData({ editSubmitting: false });
        wx.showToast({
          title: '上传图片失败',
          icon: 'none'
        });
      }
    });
  },

  // 更新飞机信息
  updateAircraftInfo: function(updateData) {
    wx.cloud.callFunction({
      name: 'updateAircraft',
      data: updateData,
      success: (res) => {
        console.log('更新飞机信息成功:', res);
        this.setData({ editSubmitting: false });
        this.closeEditModal();
        this.loadAircraftList(); // 重新加载列表
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('更新飞机信息失败:', err);
        this.setData({ editSubmitting: false });
        wx.showToast({
          title: '更新失败',
          icon: 'none'
        });
      }
    });
  },

  // 删除飞机
  deleteAircraft: function(e) {
    const { id, index } = e.currentTarget.dataset;
    const aircraft = this.data.aircraftList[index];
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除飞机"${aircraft.serialNumber}"吗？此操作不可恢复。`,
      confirmText: '删除',
      confirmColor: '#ff4757',
      success: (res) => {
        if (res.confirm) {
          this.confirmDeleteAircraft(id);
        }
      }
    });
  },

  // 确认删除飞机
  confirmDeleteAircraft: function(id) {
    wx.showLoading({
      title: '删除中...',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'deleteAircraft',
      data: { id: id },
      success: (res) => {
        console.log('删除飞机云函数返回:', res);
        wx.hideLoading();
        
        // 检查云函数返回结果，正确处理绑定状态检查
        if (res.result && res.result.success) {
          // 删除成功
          console.log('删除飞机成功:', res);
          
          // 触发全局事件，通知其他页面数据已更新
          const app = getApp();
          app.emit('aircraftListUpdated', []);
          
          // 强制重新加载飞机列表，确保与数据库同步
          setTimeout(() => {
            this.loadAircraftList(true);
          }, 500);
          
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        } else {
          // 删除失败，显示云函数返回的错误信息
          const errorMessage = res.result ? res.result.message : '删除失败';
          console.error('删除飞机失败:', errorMessage);
          wx.showToast({
            title: errorMessage,
            icon: 'none',
            duration: 3000
          });
        }
      },
      fail: (err) => {
        console.error('删除飞机失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        });
      }
    });
  },


});