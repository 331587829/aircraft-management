// 个人中心页面逻辑
const cloudFunctionHelper = require('../../utils/cloudFunctionHelper');

Page({
  data: {
    userInfo: {
      nickName: '',
      avatar: '/images/user-avatar.png',
      phone: '未绑定',
      level: 1,
      points: 0,
      hasBoundAircraft: false
    },
    isAdmin: false,
    ownerServices: [
      { id: 'bind-aircraft', title: '绑定飞机', subtitle: '添加新的飞机', icon: '🔗', url: '/pages/bind-aircraft/bind-aircraft' },
      { id: 'manual', title: '机主手册', subtitle: '使用指南与帮助', icon: '📖', url: '' },
      { id: 'journey', title: '我的旅程', subtitle: '飞行记录与统计', icon: '🗺️', url: '/pages/my-journey/my-journey' }
    ],
    myAssets: [
      { id: 'aircraft', title: '我的飞机', count: 0, icon: '✈️', url: '/pages/aircraft/aircraft' },
      { id: 'documents', title: '我的资料', count: 0, icon: '📚', url: '/pages/documents/documents' }
    ]
  },

  /**
   * 注册全局事件监听器
   */
  registerEventListeners: function() {
    const app = getApp();
    const that = this;
    
    // 监听飞机列表更新事件
    this.onAircraftListUpdated = function(event) {
      console.log('收到飞机列表更新事件', event);
      
      // 处理不同格式的事件数据
      let aircraftList = [];
      if (event && event.aircraftList) {
        aircraftList = event.aircraftList;
      } else if (Array.isArray(event)) {
        aircraftList = event;
      } else if (event && event.data && Array.isArray(event.data.aircraftList)) {
        aircraftList = event.data.aircraftList;
      }
      
      if (aircraftList.length > 0 || aircraftList.length === 0) {
        console.log('更新页面数据，飞机数量:', aircraftList.length);
        // 直接更新页面显示，避免循环更新全局数据
        that.updateUIFromGlobalData();
      }
    };
    
    // 监听用户信息更新事件
    this.onUserInfoUpdated = function(event) {
      console.log('收到用户信息更新事件', event);
      // 直接更新页面UI，不再调用getUserInfo
      that.updateUIFromGlobalData();
    };
    
    // 注册事件监听器
    app.on('aircraftListUpdated', this.onAircraftListUpdated);
    app.on('userInfoUpdated', this.onUserInfoUpdated);
    
    console.log('已注册全局事件监听器');
  },

  onLoad: function (options) {
    console.log('profile页面加载，options:', options);
    
    // 注册全局事件监听器
    this.registerEventListeners();
    
    // 立即检查管理员权限
    this.checkAdminPermission();
  },

  onUnload: function() {
    console.log('profile页面卸载');
    
    // 移除全局事件监听器
    const app = getApp();
    if (this.onAircraftListUpdated) {
      app.off('aircraftListUpdated', this.onAircraftListUpdated);
    }
    if (this.onUserInfoUpdated) {
      app.off('userInfoUpdated', this.onUserInfoUpdated);
    }
  },
  
  // 检查管理员权限
  checkAdminPermission: function() {
    const that = this;
    const app = getApp();
    
    // 优先使用全局缓存
    if (app.globalData.userInfo.isAdmin) {
      that.setData({ isAdmin: true });
      return;
    }

    wx.cloud.callFunction({
      name: 'getOpenId',
      success: (res) => {
        if (res.result && res.result.userInfo && res.result.userInfo.isAdmin) {
          console.log('确认管理员权限:', res.result.userInfo.isAdmin);
          if (app.globalData.userInfo) {
            app.globalData.userInfo.isAdmin = true;
          }
          that.setData({
            isAdmin: true
          });
        }
      },
      fail: (err) => {
        console.error('检查管理员权限失败:', err);
      }
    });
  },

  onShow: function() {
    console.log('profile页面显示');
    // 每次显示都更新数据，确保实时性
    this.updateUIFromGlobalData();
  },

  // 从全局数据更新UI
  updateUIFromGlobalData: function() {
    const app = getApp();
    const globalUserInfo = app.globalData.userInfo || {};
    const aircraftList = globalUserInfo.aircraftList || [];
    const aircraftCount = aircraftList.length;
    const hasBoundAircraft = aircraftCount > 0;

    // 构造页面需要的 userInfo 对象
    const userInfo = {
      nickName: globalUserInfo.wechatInfo?.nickName || '机主用户',
      avatar: globalUserInfo.wechatInfo?.avatarUrl || '/images/user-avatar.png',
      phone: globalUserInfo.wechatInfo?.phoneNumber || '未绑定',
      level: globalUserInfo.wechatInfo?.level || 1,
      points: globalUserInfo.wechatInfo?.points || 0,
      hasBoundAircraft: hasBoundAircraft,
      boundAircraftCount: aircraftCount,
      aircraftStatus: {
        flying: aircraftCount, // 简化逻辑：所有飞机视为运营中
        parked: 0,
        total: aircraftCount
      }
    };

    this.setData({
      userInfo: userInfo,
      'myAssets[0].count': aircraftCount,
      isAdmin: globalUserInfo.isAdmin || false
    });
    
    console.log('UI已从全局数据更新:', userInfo);
  },

  // 监听器回调：飞机列表更新
  onAircraftListUpdated: function(aircraftList) {
    console.log('收到飞机列表更新事件:', aircraftList);
    this.updateUIFromGlobalData();
  },
  
  // 监听器回调：用户信息更新
  onUserInfoUpdated: function(userInfo) {
    console.log('收到用户信息更新事件:', userInfo);
    this.updateUIFromGlobalData();
  },

  // 点击机主服务
  onServiceClick: function(e) {
    const itemId = e.currentTarget.dataset.id;
    console.log('点击了机主服务，ID:', itemId);
    
    const service = this.data.ownerServices.find(item => item.id === itemId);
    console.log('找到的服务项:', service);
    

    
    if (service && service.url) {
      console.log('即将跳转到:', service.url);
      
      // 检查是否为tabBar页面，如果是则使用switchTab
      const tabBarPages = [
        '/pages/index/index',
        '/pages/aircraft/aircraft',
        '/pages/documents/documents',
        '/pages/profile/profile'
      ];
      
      if (tabBarPages.includes(service.url)) {
        wx.switchTab({
          url: service.url,
          fail: function(err) {
            console.error('页面跳转失败:', err);
            wx.showToast({
              title: '页面跳转失败',
              icon: 'none'
            });
          }
        });
      } else {
        wx.navigateTo({
          url: service.url,
          fail: function(err) {
            console.error('页面跳转失败:', err);
            wx.showToast({
              title: '页面跳转失败',
              icon: 'none'
            });
          }
        });
      }
    } else {
      console.error('未找到对应的服务项或服务项没有URL');
      wx.showToast({
        title: '服务暂未开放',
        icon: 'none'
      });
    }
  },
  
  onAssetClick: function(e) {
    const itemId = e.currentTarget.dataset.id;
    console.log('点击了资产项，ID:', itemId);
    
    const asset = this.data.myAssets.find(item => item.id === itemId);
    console.log('找到的资产项:', asset);
    
    if (asset && asset.url) {
      console.log('即将跳转到:', asset.url);
      
      // 检查是否为tabBar页面，如果是则使用switchTab
      const tabBarPages = [
        '/pages/index/index',
        '/pages/aircraft/aircraft',
        '/pages/documents/documents',
        '/pages/profile/profile'
      ];
      
      if (tabBarPages.includes(asset.url)) {
        console.log('使用switchTab跳转到tabBar页面:', asset.url);
        wx.switchTab({
          url: asset.url,
          fail: function(err) {
            console.error('页面跳转失败:', err);
            wx.showToast({
              title: '页面跳转失败',
              icon: 'none'
            });
          }
        });
      } else {
        console.log('使用navigateTo跳转到普通页面:', asset.url);
        wx.navigateTo({
          url: asset.url,
          fail: function(err) {
            console.error('页面跳转失败:', err);
            wx.showToast({
              title: '页面跳转失败',
              icon: 'none'
            });
          }
        });
      }
    } else {
      console.error('未找到对应的资产项或资产项没有URL');
      wx.showToast({
        title: '功能暂未开放',
        icon: 'none'
      });
    }
  },







  // 刷新页面数据
  refreshData: function() {
    wx.showLoading({
      title: '刷新中...'
    });
    
    // 检查并更新用户信息
    const app = getApp();
    
    // 触发云函数更新数据
    wx.cloud.callFunction({
      name: 'getOpenId',
      success: (res) => {
        console.log('手动刷新：获取最新用户状态成功');
        // 更新全局数据，app.js中的updateGlobalData会自动触发事件更新页面
        if (res.result && res.result.userInfo) {
          app.updateUserInfo({
            wechatInfo: res.result.userInfo,
            hasBoundAircraft: res.result.isBound,
            isAdmin: res.result.isAdmin
          });
        }
        
        // 如果已绑定飞机，刷新飞机列表
        if (res.result && res.result.isBound) {
           app.getBoundAircraftList();
        }
        
        wx.hideLoading();
        wx.showToast({
          title: '刷新成功',
          icon: 'success'
        });
      },
      fail: (err) => {
        console.error('手动刷新失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '刷新失败',
          icon: 'none'
        });
      }
    });
  },



  // 编辑用户信息
  editUserInfo: function() {
    const app = getApp();
    
    // 添加防抖动检查
    const currentTime = Date.now();
    if (this.lastClickTime && (currentTime - this.lastClickTime) < 1000) {
      console.log('点击过于频繁，请稍后再试');
      wx.showToast({
        title: '点击过于频繁，请稍后再试',
        icon: 'none'
      });
      return;
    }
    this.lastClickTime = currentTime;
    
    // 如果用户已经授权，直接跳转到编辑页面
    if (app.globalData.userInfo && app.globalData.userInfo.wechatInfo && app.globalData.userInfo.wechatInfo.nickName) {
      wx.navigateTo({
        url: '/pages/edit-profile/edit-profile'
      });
      return;
    }
    
    // 如果用户未授权，调用getUserProfile获取用户信息
    const that = this;
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        console.log('通过微信API获取用户信息成功', res.userInfo);
        const userInfo = res.userInfo;
        
        // 使用 app.js 的统一方法更新全局数据和本地存储
        app.updateUserInfo(userInfo);
        
        that.setData({
          'userInfo.nickName': userInfo.nickName,
          'userInfo.avatar': userInfo.avatarUrl,
          'userInfo.hasBoundAircraft': app.globalData.userInfo.hasBoundAircraft || false
        });
        
        // 获取成功后跳转到编辑页面
        wx.navigateTo({
          url: '/pages/edit-profile/edit-profile'
        });
      },
      fail: (err) => {
        console.error('获取用户信息失败', err);
        // 如果是频繁调用错误，给出更友好的提示
        if (err.errMsg && err.errMsg.includes('too frequently')) {
          wx.showToast({
            title: '请稍后再试',
            icon: 'none'
          });
        } else {
          wx.showToast({
            title: '获取用户信息失败',
            icon: 'none'
          });
        }
      }
    });
  },

  // 检查管理员权限（已合并到上面的checkAdminPermission方法中）

  // 跳转到管理页面
  goToAdminPage: function() {
    wx.navigateTo({
      url: '/pages/admin/admin'
    });
  },

  // 跳转到信息管理页面
  goToInfoManagement: function() {
    wx.navigateTo({
      url: '/pages/info-management/info-management'
    });
  },

  // 跳转到用户管理页面
  goToUserManagement: function() {
    wx.navigateTo({
      url: '/pages/user-management/user-management'
    });
  }
});