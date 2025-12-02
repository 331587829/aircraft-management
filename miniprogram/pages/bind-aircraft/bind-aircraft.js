// 飞机绑定页面逻辑
Page({
  data: {
    aircraftSerialNumber: '',  // 飞机序列号
    isValidSerialNumber: false, // 序列号是否有效
    aircraftInfo: null,        // 飞机信息
    boundAircraftList: [],     // 已绑定飞机列表
    isBinding: false,          // 是否正在绑定中
    errorMessage: '',          // 错误信息
    isLoadingAircraftInfo: false, // 是否正在查询飞机信息
    isFocused: false           // 输入框聚焦状态
  },

  onLoad: function() {
    // 页面加载时获取用户已绑定的飞机列表
    this.getBoundAircraftList();
  },

  // 监听输入框聚焦
  onInputFocus: function() {
    this.setData({
      isFocused: true
    });
  },

  // 监听输入框失去焦点
  onInputBlur: function() {
    this.setData({
      isFocused: false
    });
  },

  // 监听序列号输入
  onSerialNumberInput: function(e) {
    const serialNumber = e.detail.value;
    this.setData({
      aircraftSerialNumber: serialNumber
    });
    
    // 验证序列号格式（简单验证，实际项目中可能需要更复杂的验证逻辑）
    const isValid = this.validateSerialNumber(serialNumber);
    
    this.setData({
      isValidSerialNumber: isValid
    });
    
    // 移除自动查询逻辑，改为手动触发或回车触发
    // 这样可以避免输入过程中的频繁查询和跳动
  },

  // 监听键盘回车/搜索键
  onSearchConfirm: function(e) {
    const serialNumber = e.detail.value;
    this.performSearch(serialNumber);
  },

  // 监听查询按钮点击
  onSearchClick: function() {
    const serialNumber = this.data.aircraftSerialNumber;
    this.performSearch(serialNumber);
  },

  // 执行查询逻辑
  performSearch: function(serialNumber) {
    if (!serialNumber) return;
    
    const isValid = this.validateSerialNumber(serialNumber);
    if (isValid) {
      this.getAircraftInfo(serialNumber);
    } else {
      wx.showToast({
        title: '序列号格式不正确',
        icon: 'none'
      });
    }
  },

  // 监听输入框失去焦点事件
  onSerialNumberBlur: function(e) {
    this.setData({
      isFocused: false
    });
    // 失去焦点时不自动查询，避免干扰用户
  },

  // 验证飞机序列号格式
  validateSerialNumber: function(serialNumber) {
    // 更灵活的验证逻辑，支持多种格式：
    // 1. B-1234（标准格式）
    // 2. B-121315（长序列号）
    // 3. N12345（美国格式）
    // 4. 纯数字格式
    const regex = /^[A-Z0-9-]{3,20}$/;
    return regex.test(serialNumber.toUpperCase());
  },

  // 查询飞机信息
  getAircraftInfo: function(serialNumber) {
    const that = this;
    
    console.log('准备查询飞机信息，序列号:', serialNumber);
    
    // 强制重置loading状态，防止上次卡住
    this.setData({
      isLoadingAircraftInfo: true,
      errorMessage: '' // 清除旧错误
    });
    
    wx.cloud.callFunction({
      name: 'getAircraftInfo',
      data: {
        serialNumber: serialNumber.toUpperCase()
      },
      success: res => {
        console.log('获取飞机信息云函数返回:', res);
        
        // 兼容处理：有些云函数直接返回数据，有些包在result里
        const result = res.result;
        
        if (result && (result.success || result.aircraftInfo)) {
          const aircraftInfo = result.aircraftInfo || (result.success ? null : result);
          
          if (aircraftInfo) {
            console.log('成功获取到飞机详情:', aircraftInfo);
            that.setData({
              aircraftInfo: aircraftInfo,
              isLoadingAircraftInfo: false,
              errorMessage: ''
            });
          } else {
            console.warn('返回成功但无aircraftInfo字段:', result);
            that.setData({
              aircraftInfo: null,
              errorMessage: result.message || '未找到该飞机信息',
              isLoadingAircraftInfo: false
            });
            that.hideErrorAfterDelay();
          }
        } else {
          console.warn('查询结果显示失败:', result);
          that.setData({
            aircraftInfo: null,
            errorMessage: (result && result.message) ? result.message : '未找到该飞机信息',
            isLoadingAircraftInfo: false
          });
          that.hideErrorAfterDelay();
        }
      },
      fail: err => {
        console.error('获取飞机信息调用失败:', err);
        that.setData({
          aircraftInfo: null,
          errorMessage: '网络请求失败，请重试',
          isLoadingAircraftInfo: false
        });
        that.hideErrorAfterDelay();
      }
    });
  },

  // 获取已绑定飞机列表
  getBoundAircraftList: function() {
    const that = this;
    
    wx.cloud.callFunction({
      name: 'getBoundAircraftList',
      success: res => {
        console.log('获取已绑定飞机列表成功', res);
        if (res.result && res.result.aircraftList) {
          that.setData({
            boundAircraftList: res.result.aircraftList
          });
        }
      },
      fail: err => {
        console.error('获取已绑定飞机列表失败', err);
      }
    });
  },

  // 处理绑定飞机
  handleBindAircraft: function() {
    const that = this;
    const { aircraftSerialNumber, aircraftInfo, isValidSerialNumber, boundAircraftList } = this.data;
    
    // 验证序列号和飞机信息
    if (!isValidSerialNumber || !aircraftSerialNumber) {
      this.setData({
        errorMessage: '请先输入有效的飞机序列号'
      });
      this.hideErrorAfterDelay();
      return;
    }
    
    if (!aircraftInfo) {
      this.setData({
        errorMessage: '请先查询并确认飞机信息'
      });
      this.hideErrorAfterDelay();
      return;
    }
    
    // 检查是否已经绑定了该飞机
    const normalizedSerialNumber = aircraftSerialNumber.toUpperCase();
    const isAlreadyBound = boundAircraftList.some(aircraft => 
      aircraft.serialNumber === normalizedSerialNumber
    );
    
    if (isAlreadyBound) {
      // 使用更明显的提示方式
      wx.showModal({
        title: '重复绑定',
        content: '您已经绑定了该飞机，无需重复绑定。',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }
    
    // 设置绑定中状态
    this.setData({
      isBinding: true
    });
    
    // 调用云函数绑定飞机
    wx.cloud.callFunction({
      name: 'bindAircraft',
      data: {
        serialNumber: aircraftSerialNumber.toUpperCase(),
        aircraftInfo: aircraftInfo
      },
      success: res => {
        console.log('绑定飞机成功', res);
        
        // 显示绑定成功提示
        wx.showToast({
          title: '绑定成功',
          icon: 'success',
          duration: 2000
        });
        
        // 重置表单并刷新已绑定飞机列表
        that.setData({
          aircraftSerialNumber: '',
          isValidSerialNumber: false,
          aircraftInfo: null,
          isBinding: false
        });
        
        // 刷新已绑定飞机列表
        setTimeout(() => {
          that.getBoundAircraftList();
          // 更新全局数据中的飞机列表
          that.updateGlobalAircraftList();
        }, 2000);
      },
      fail: err => {
        console.error('绑定飞机失败', err);
        that.setData({
          isBinding: false,
          errorMessage: '绑定失败，请重试'
        });
        that.hideErrorAfterDelay();
      }
    });
  },

  // 更新全局数据中的飞机列表
  updateGlobalAircraftList: function() {
    const app = getApp();
    
    // 重新获取已绑定飞机列表并更新全局数据
    wx.cloud.callFunction({
      name: 'getBoundAircraftList',
      success: res => {
        console.log('更新全局飞机列表成功', res);
        if (res.result && res.result.aircraftList) {
          // 更新全局数据
        app.globalData.userInfo.aircraftList = res.result.aircraftList;
        app.globalData.userInfo.hasBoundAircraft = res.result.aircraftList.length > 0;
        // 移除重复的isAuthenticated属性，统一使用hasBoundAircraft
          
          console.log('全局数据已更新，飞机数量:', res.result.aircraftList.length);
          
          // 使用 app.js 的统一方法更新全局数据和本地存储，并触发相关事件
          app.updateUserInfo({
            aircraftList: res.result.aircraftList,
            hasBoundAircraft: res.result.aircraftList.length > 0
          });
          
          // 不再自动返回上一页，而是留在当前页面让用户继续操作
          console.log('数据更新完成，留在当前页面');
        }
      },
      fail: err => {
        console.error('更新全局飞机列表失败', err);
      }
    });
  },

  // 解除绑定飞机
  unbindAircraft: function(e) {
    const that = this;
    const aircraftId = e.currentTarget.dataset.id;
    
    // 确认解除绑定
    wx.showModal({
      title: '确认解除绑定',
      content: '确定要解除绑定这架飞机吗？',
      success: function(res) {
        if (res.confirm) {
          // 调用云函数解除绑定
          wx.cloud.callFunction({
            name: 'unbindAircraft',
            data: {
              aircraftId: aircraftId
            },
            success: res => {
              console.log('解除绑定成功', res);
              wx.showToast({
                title: '解除绑定成功',
                icon: 'success',
                duration: 2000
              });
              
              // 立即刷新已绑定飞机列表
              that.getBoundAircraftList();
              
              // 立即更新全局数据，确保解绑操作立即生效
              that.updateGlobalAircraftList();
              
              // 强制刷新个人中心页面数据
              const app = getApp();
              // 使用 app.js 的统一方法更新全局数据和本地存储
              app.updateUserInfo({
                aircraftList: [],
                hasBoundAircraft: false
              });
              
              // 不再自动跳转，留在当前页面
              console.log('解绑完成，留在当前页面');
            },
            fail: err => {
              console.error('解除绑定失败', err);
              that.setData({
                errorMessage: '解除绑定失败，请重试'
              });
              that.hideErrorAfterDelay();
            }
          });
        }
      }
    });
  },

  // 延迟隐藏错误信息
  hideErrorAfterDelay: function() {
    const that = this;
    setTimeout(() => {
      that.setData({
        errorMessage: ''
      });
    }, 3000);
  }
});