// 信息管理页面逻辑
Page({
  data: {
    // 文档类型列表
    documentTypes: [
      {
        id: 'notice',
        title: '服务通告',
        icon: '📋',
        description: '飞机维护和服务相关通告',
        count: 0,
        tags: ['服务通告', '维护'],
        color: '#4A90E2'
      },
      {
        id: 'letter',
        title: '服务信函',
        icon: '🔧',
        description: '技术服务和操作指导信函',
        count: 0,
        tags: ['服务信函', '技术'],
        color: '#50C878'
      },
      {
        id: 'news',
        title: '新闻资讯',
        icon: '📰',
        description: '行业新闻和公司动态',
        count: 0,
        tags: ['新闻资讯'],
        color: '#FF6B6B'
      },
      {
        id: 'manual',
        title: '技术手册',
        icon: '📚',
        description: '操作手册和技术文档',
        count: 0,
        tags: ['技术手册'],
        color: '#9B59B6'
      }
    ],
    
    // 快速发布选项
    publishOptions: [
      {
        id: 'quick-publish',
        title: '快速发布',
        description: '一键发布新文档'
      }
    ],
    
    selectedType: null, // 当前选中的文档类型
    loading: false, // 加载状态
    
    // 页面可见性标记
    pageVisible: false
  },

  onLoad: function(options) {
    console.log('信息管理页面加载');
    wx.setNavigationBarTitle({ title: '信息管理' })
    
    // 页面加载时标记为不可见，等待onShow时再加载数据
    this.setData({
      pageVisible: false
    });
    
    // 注册全局事件监听器
    this.registerEventListeners();
    
    // 测试事件系统是否正常工作
    const app = getApp();
    console.log('事件系统测试 - 当前已注册的事件监听器:', app.globalEventListeners);
    
    console.log('信息管理页面加载完成，等待显示时加载数据');
  },

  onShow: function() {
    console.log('信息管理页面显示');
    
    // 标记页面为可见状态
    this.setData({
      pageVisible: true
    });
    
    // 无论页面是否已有数据，都强制刷新统计数据
    // 因为用户可能从其他页面（如发布或删除页面）返回，需要确保数据最新
    console.log('信息管理页面显示，强制刷新文档统计');
    this.getDocumentCounts();
  },

  // 获取文档统计（管理页面使用实时数据，不依赖缓存）
  getDocumentCounts: function() {
    const that = this;
    
    // 直接调用云函数获取实时数据
    wx.cloud.callFunction({
      name: 'getDocumentStatistics',
      success: res => {
        if (res.result.success) {
          const stats = res.result.data;
          
          // 更新文档类型统计
          that.setData({
            documentTypes: stats,
            totalDocuments: res.result.total || 0
          });
          
          console.log('文档统计已更新，实时数据:', stats);
        } else {
          console.error('获取文档统计失败:', res.result.message);
          // 直接显示空状态
          that.setData({
            documentTypes: [],
            totalDocuments: 0
          });
          wx.showToast({
            title: '获取文档统计失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('调用文档统计云函数失败:', err);
        // 直接显示空状态
        that.setData({
          documentTypes: [],
          totalDocuments: 0
        });
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 点击文档类型
  onDocumentTypeClick: function(e) {
    const typeId = e.currentTarget.dataset.id;
    const type = this.data.documentTypes.find(item => item.id === typeId);
    
    if (type) {
      this.setData({
        selectedType: type
      });
      
      // 跳转到该类别的 document-list（支持编辑/删除）
      let category = '';
      if (type.id === 'notice') {
        category = 'service_notice';
      } else if (type.id === 'letter') {
        category = 'service_letter';
      } else if (type.id === 'news') {
        category = 'news';
      } else if (type.id === 'manual') {
        category = 'manual';
      }
      const title = type.title || ''
      wx.navigateTo({
        url: `/pages/document-list/document-list?categoryId=${encodeURIComponent(category)}&title=${encodeURIComponent(title)}&from=management`
      })
    }
  },

  // 点击发布选项
  onPublishOptionClick: function(e) {
    const optionId = e.currentTarget.dataset.id;
    
    if (optionId === 'quick-publish') {
      this.showAddDocumentDialog();
    }
  },

  // 直接跳转到发布页面，让用户手动选择文档分类
  showAddDocumentDialog: function() {
    wx.navigateTo({
      url: '/pages/document-edit/document-edit?action=add'
    });
  },



  // 刷新数据
  refreshData: function() {
    wx.showLoading({
      title: '刷新中...'
    });
    
    this.getDocumentCounts();
    
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '刷新成功',
        icon: 'success'
      });
    }, 1000);
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function() {
    console.log('信息管理页面隐藏');
    // 标记页面为不可见状态
    this.setData({
      pageVisible: false
    });
    
    // 移除事件监听器
    this.removeEventListeners();
  },
  
  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function() {
    console.log('信息管理页面卸载');
    // 移除事件监听器
    this.removeEventListeners();
  },
  
  // 注册全局事件监听器
  registerEventListeners: function() {
    const app = getApp();
    
    // 监听文档列表更新事件
    this.onDocumentListUpdated = (data) => {
      console.log('信息管理页面收到文档列表更新事件，数据:', data);
      
      // 无论页面是否可见，都强制刷新统计数据
      // 因为用户可能从其他页面返回，需要确保数据最新
      console.log('触发文档列表更新事件，立即刷新统计数据');
      this.getDocumentCounts();
    };
    
    app.on('documentListUpdated', this.onDocumentListUpdated);
    console.log('信息管理页面已注册文档列表更新事件监听器');
    
    // 测试事件系统
    console.log('事件系统测试 - 当前已注册的documentListUpdated监听器数量:', 
      app.globalEventListeners.documentListUpdated ? app.globalEventListeners.documentListUpdated.length : 0);
  },
  
  // 移除事件监听器
  removeEventListeners: function() {
    const app = getApp();
    
    if (this.onDocumentListUpdated) {
      app.off('documentListUpdated', this.onDocumentListUpdated);
      console.log('信息管理页面已移除文档列表更新事件监听器');
    }
  }
});