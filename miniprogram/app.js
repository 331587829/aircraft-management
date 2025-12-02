// app.js
// 引入统一的云函数调用工具
const cloudFunctionHelper = require('./utils/cloudFunctionHelper');

App({
  // 全局事件监听器
  globalEventListeners: {},
  
  // 注册全局事件监听器
  on: function(eventName, callback) {
    if (!this.globalEventListeners[eventName]) {
      this.globalEventListeners[eventName] = [];
    }
    this.globalEventListeners[eventName].push(callback);
  },
  
  // 触发全局事件
  emit: function(eventName, data) {
    const listeners = this.globalEventListeners[eventName];
    if (listeners && listeners.length > 0) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`全局事件 ${eventName} 监听器执行错误:`, error);
        }
      });
    }
  },
  
  // 移除全局事件监听器
  off: function(eventName, callback) {
    const listeners = this.globalEventListeners[eventName];
    if (listeners) {
      if (callback) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      } else {
        this.globalEventListeners[eventName] = [];
      }
    }
  },
  
  onLaunch: function() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-8gaa4jfy4b22cd28', // 当前云开发环境 ID  
        traceUser: true,
      });
      console.log('云开发环境初始化完成');
    }

    // 兼容性处理：确保updateManager正确初始化
    try {
      if (wx.getUpdateManager) {
        const updateManager = wx.getUpdateManager();
        // 确保enableUpdateWxAppCode属性存在，避免报错
        if (updateManager && typeof updateManager.enableUpdateWxAppCode === 'undefined') {
          updateManager.enableUpdateWxAppCode = false;
        }
      }
    } catch (e) {
      console.warn('updateManager初始化失败:', e);
    }

    // 检查是否是首次使用
    this.checkFirstTimeUser();
  },

  // 检查是否是首次使用
  checkFirstTimeUser: function() {
    this.checkUserLoginStatus();
  },

  /**
   * 检查用户登录状态
   */
  checkUserLoginStatus: function() {
    const that = this;
    
    // 立即初始化默认用户信息，避免页面等待超时
    that.globalData.isLoggedIn = false;
    that.globalData.userInfo = {
      wechatInfo: {},
      hasBoundAircraft: false,
      aircraftList: []
    };
    
    // 触发用户信息更新事件，通知页面数据已就绪
    that.emit('userInfoUpdated', that.globalData.userInfo);
    
    // 优先从本地存储恢复完整数据（包含飞机列表）
    const storedUserInfo = wx.getStorageSync('userInfo');
    if (storedUserInfo) {
      // 恢复基础信息
      if (storedUserInfo.wechatInfo) {
        that.globalData.userInfo.wechatInfo = storedUserInfo.wechatInfo;
      }
      // 恢复飞机列表（如果存在且有效）
      if (Array.isArray(storedUserInfo.aircraftList)) {
        that.globalData.userInfo.aircraftList = storedUserInfo.aircraftList;
        that.globalData.userInfo.hasBoundAircraft = storedUserInfo.aircraftList.length > 0;
      }
      // 恢复其他状态
      if (typeof storedUserInfo.isAdmin === 'boolean') {
        that.globalData.userInfo.isAdmin = storedUserInfo.isAdmin;
      }
      
      // 立即通知页面更新
      that.emit('userInfoUpdated', that.globalData.userInfo);
      that.emit('aircraftListUpdated', that.globalData.userInfo.aircraftList);
    }
    
    // 使用现有的getOpenId云函数检查用户登录状态
    cloudFunctionHelper.callCloudFunctionWithNetworkCheck(
      'getOpenId',
      {},
      {
        showLoading: false, // 不显示加载提示
        showErrorToast: false, // 不显示错误提示
        timeout: 8000
      }
    ).then(res => {
      console.log('用户登录状态检查结果:', res);
      
      // 检查云函数调用是否成功，并且有返回数据
      if (res && (res.openid || (res.result && res.result.openid))) {
        // 用户已登录，更新全局用户信息
        const result = res.result ? res.result : res;
        
        // 确保wechatInfo对象存在
        if (!that.globalData.userInfo.wechatInfo) {
          that.globalData.userInfo.wechatInfo = {};
        }
        
        // 更新用户信息
        that.globalData.userInfo.wechatInfo.openid = result.openid || '';
        that.globalData.userInfo.wechatInfo.appid = result.appid || '';
        that.globalData.userInfo.hasBoundAircraft = result.isBound || false;
        that.globalData.userInfo.isAdmin = result.isAdmin || false; // 统一获取管理员状态
        that.globalData.isLoggedIn = true;
        
        // 如果云函数返回了用户信息，更新全局数据和本地存储
        if (result.userInfo) {
          that.globalData.userInfo.wechatInfo = result.userInfo;
        }
        
        // 检查并获取手机号码
        if (result.phoneNumber) {
          that.globalData.userInfo.wechatInfo.phoneNumber = result.phoneNumber;
        }
        
        // 更新本地缓存（保存完整状态）
        wx.setStorage({
          key: 'userInfo',
          data: {
            wechatInfo: that.globalData.userInfo.wechatInfo,
            aircraftList: that.globalData.userInfo.aircraftList,
            isAdmin: that.globalData.userInfo.isAdmin
          }
        });

        console.log('用户登录状态检查完成:', {
          isLoggedIn: that.globalData.isLoggedIn,
          isAdmin: that.globalData.userInfo.isAdmin,
          hasBoundAircraft: that.globalData.userInfo.hasBoundAircraft
        });
        
        // 触发用户信息更新事件
        that.emit('userInfoUpdated', that.globalData.userInfo);
        
        console.log('用户登录状态检查成功，用户信息已更新');
        
        // 如果用户已绑定飞机，获取飞机列表数据
        if (that.globalData.userInfo.hasBoundAircraft) {
          console.log('用户已绑定飞机，获取飞机列表数据');
          that.getBoundAircraftList();
        } else {
          console.log('用户未绑定飞机，请先绑定飞机信息');
        }
      } else {
        // 用户未登录或检查失败，保持默认用户信息
        console.log('用户未登录或检查失败，使用默认用户信息');
      }
    }).catch(err => {
      console.error('用户登录状态检查失败:', err);
      // 保持默认用户信息，不进行额外处理
    });
  },
  
  // 统一更新用户信息的方法
  updateUserInfo: function(userInfo, persistToStorage = true) {
    const that = this;
    
    // 更新全局数据
    if (userInfo) {
      if (userInfo.wechatInfo) {
        that.globalData.userInfo.wechatInfo = {
          ...that.globalData.userInfo.wechatInfo,
          ...userInfo.wechatInfo
        };
      }
      // 如果传入的是直接的微信用户信息（nickName, avatarUrl等）
      else if (userInfo.nickName) {
        that.globalData.userInfo.wechatInfo = {
          ...that.globalData.userInfo.wechatInfo,
          ...userInfo
        };
      }
      
      // 更新其他字段
      if (userInfo.hasBoundAircraft !== undefined) {
        that.globalData.userInfo.hasBoundAircraft = userInfo.hasBoundAircraft;
      }
      if (userInfo.aircraftList !== undefined) {
        that.globalData.userInfo.aircraftList = userInfo.aircraftList;
      }
      if (userInfo.isAdmin !== undefined) {
        that.globalData.userInfo.isAdmin = userInfo.isAdmin;
      }
    }
    
    // 持久化到本地存储
    if (persistToStorage) {
      wx.setStorage({
        key: 'userInfo',
        data: {
          wechatInfo: that.globalData.userInfo.wechatInfo,
          aircraftList: that.globalData.userInfo.aircraftList,
          isAdmin: that.globalData.userInfo.isAdmin
        }
      });
    }
    
    // 触发更新事件
    that.emit('userInfoUpdated', that.globalData.userInfo);
    if (userInfo && userInfo.aircraftList) {
      that.emit('aircraftListUpdated', that.globalData.userInfo.aircraftList);
    }
    
    console.log('全局用户信息已更新:', that.globalData.userInfo);
  },
  
  // 调用getOpenId云函数（简化缓存策略）
  callGetOpenIdFunction: function() {
    const that = this;
    
    wx.cloud.callFunction({
      name: 'getOpenId',
      success: res => {
        console.log('获取用户登录状态成功', res);
        
        // 统一使用云函数返回的最新数据
        that.globalData.userInfo.wechatInfo.openid = res.result.openid || '';
        that.globalData.userInfo.wechatInfo.appid = res.result.appid || '';
        
        // 使用云函数返回的绑定状态和管理员状态
        that.globalData.userInfo.hasBoundAircraft = res.result.isBound || false;
        that.globalData.userInfo.isAdmin = res.result.isAdmin || false;
        
        // 如果云函数返回了用户信息，更新全局数据和本地存储
        if (res.result.userInfo) {
          that.globalData.userInfo.wechatInfo = res.result.userInfo;
          // 保存到本地存储（仅保存用户基本信息）
          wx.setStorage({
            key: 'userInfo',
            data: res.result.userInfo
          });
        }
        
        // 检查并获取手机号码
        if (res.result.phoneNumber) {
          that.globalData.userInfo.wechatInfo.phoneNumber = res.result.phoneNumber;
        }
        
        // 如果用户已绑定飞机，获取飞机列表数据
        if (that.globalData.userInfo.hasBoundAircraft) {
          console.log('用户已绑定飞机，获取飞机列表数据');
          that.getBoundAircraftList();
        } else {
          console.log('用户未绑定飞机，请先绑定飞机信息');
          // 可以在这里添加用户引导逻辑，比如显示绑定提示
        }
      },
      fail: err => {
        console.error('获取用户登录状态失败', err);
        
        // 云函数失败时，使用本地存储作为降级方案
        wx.getStorage({
          key: 'userInfo',
          success: function(storageRes) {
            console.log('云函数失败，使用本地存储的用户信息');
            that.globalData.userInfo.wechatInfo = storageRes.data;
            // 注意：这里不设置认证状态，因为需要实时数据
          },
          fail: function() {
            console.error('获取用户信息失败，请检查网络连接');
          }
        });
      }
    });
  },
  
  // 获取已绑定飞机列表并更新全局数据（简化缓存策略）
  getBoundAircraftList: function() {
    const that = this;
    
    // 直接调用云函数获取最新数据
    that.callGetAircraftListFunction();
  },
  
  // 调用getBoundAircraftList云函数获取用户绑定的飞机列表（简化缓存策略）
  callGetAircraftListFunction: function() {
    const that = this;
    
    wx.cloud.callFunction({
      name: 'getBoundAircraftList',
      data: {},
      success: res => {
        console.log('获取用户绑定飞机列表成功', res);
        
        if (res.result && res.result.aircraftList) {
          const aircraftList = res.result.aircraftList || [];
          
          // 更新全局数据
          that.globalData.userInfo.aircraftList = aircraftList;
          that.globalData.userInfo.hasBoundAircraft = aircraftList.length > 0;
          
          // 更新本地缓存
          wx.setStorage({
            key: 'userInfo',
            data: {
              wechatInfo: that.globalData.userInfo.wechatInfo,
              aircraftList: that.globalData.userInfo.aircraftList, // 确保存储飞机列表
              isAdmin: that.globalData.userInfo.isAdmin
            }
          });

          console.log('更新全局飞机数据:', {
            aircraftCount: aircraftList.length,
            hasBoundAircraft: aircraftList.length > 0
          });
          
          // 触发全局事件，通知所有页面数据已更新
          that.emit('aircraftListUpdated', aircraftList);
          
          // 兼容旧的回调方式
          if (typeof that.onAircraftListUpdated === 'function') {
            that.onAircraftListUpdated(aircraftList);
          }
        }
      },
      fail: err => {
        console.error('获取用户绑定飞机列表失败', err);
        // 失败时设置为空数组
        that.globalData.userInfo.aircraftList = [];
        that.globalData.userInfo.hasBoundAircraft = false;
      }
    });
  },
  
  // 强制刷新飞机数据（供其他页面调用）
  refreshAircraftData: function() {
    console.log('强制刷新飞机数据');
    this.getBoundAircraftList();
  },
  
  // 更新单个飞机信息
  updateAircraftInfo: function(aircraftId, newData) {
    const aircraftList = this.globalData.userInfo.aircraftList;
    const index = aircraftList.findIndex(aircraft => aircraft.id === aircraftId);
    if (index !== -1) {
      aircraftList[index] = { ...aircraftList[index], ...newData };
      this.emit('aircraftInfoUpdated', { aircraftId, newData });
    }
  },
  
  // 重置用户状态 - 用于重新初始化账号
  resetUserStatus: function() {
    const that = this;
    
    // 清除本地存储
    try {
      wx.clearStorageSync();
      console.log('已清除所有本地存储');
    } catch (e) {
      console.error('清除本地存储失败:', e);
    }
    
    // 重置全局数据
    that.globalData.userInfo = {
      hasBoundAircraft: false,
      aircraftList: [],
      wechatInfo: {}
    };
    
    // 直接进入应用首页
    wx.switchTab({
      url: '/pages/index/index'
    });
    
    wx.showToast({
      title: '已重置用户状态',
      icon: 'success'
    });
  },

  globalData: {
    userInfo: {
      nickName: '',
      avatar: '/images/user-avatar.png',
      phone: '未绑定',
      level: 1,
      points: 0,
      hasBoundAircraft: false,
      aircraftList: [],
      aircraftStatus: {},
      wechatInfo: null,
      isAdmin: false
    }
  }
});