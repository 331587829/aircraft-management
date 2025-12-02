// 首页逻辑
Page({
  data: {
    bannerList: [
      {
        id: 1,
        image: 'cloud://cloud1-8gaa4jfy4b22cd28.636c-cloud1-8gaa4jfy4b22cd28-1381889662/banner/banner1.jpg'
      },
      {
        id: 2,
        image: 'cloud://cloud1-8gaa4jfy4b22cd28.636c-cloud1-8gaa4jfy4b22cd28-1381889662/banner/banner2.jpg'
      },
      {
        id: 3,
        image: 'cloud://cloud1-8gaa4jfy4b22cd28.636c-cloud1-8gaa4jfy4b22cd28-1381889662/banner/banner3.jpg'
      }
    ],
    
    // 最新的文档列表
    latestDocuments: []
  },

  onLoad: function() {
    // 页面加载时的逻辑
    console.log('首页加载成功');
    
    // 注册文档更新事件监听器
    this.registerDocumentUpdateListener();
  },

  onShow: function() {
    console.log('首页显示');
    
    // 如果已经有文档数据，直接显示，避免重复加载
    if (this.data.latestDocuments && this.data.latestDocuments.length > 0) {
      console.log('首页已有文档数据，直接显示，避免重复加载');
      return;
    }
    
    // 首次显示或数据为空时加载数据
    console.log('首页首次显示或数据为空，加载最新文档');
    this.getLatestDocuments();
  },

  // 获取最新的文档列表
  getLatestDocuments: function(forceRefresh = false) {
    const that = this;
    
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getDocumentsByCategory',
        data: {
          categoryId: 'all', // 获取所有分类的文档
          page: 1,
          pageSize: 4
        },
        success: res => {
          if (res.result && res.result.success) {
            const documents = res.result.data || [];
            // 格式化文档数据
            const formattedDocuments = documents.map(doc => {
              // 根据分类确定文档类型和标签名称
              let type = 'news';
              let tagName = '新闻';
              
              // 根据category字段判断文档类型
              if (doc.category) {
                if (doc.category.id === 'service_notice' || doc.category.name === '服务通告') {
                  type = 'notice';
                  tagName = '通告';
                } else if (doc.category.id === 'service_letter' || doc.category.name === '服务信函') {
                  type = 'letter';
                  tagName = '信函';
                } else if (doc.category.id === 'manual' || doc.category.name === '技术手册') {
                  type = 'tech';
                  tagName = '技术';
                } else if (doc.category.id === 'news' || doc.category.name === '新闻资讯') {
                  type = 'news';
                  tagName = '新闻';
                }
              }
              
              return {
                id: doc._id || doc.id,
                title: doc.title,
                tagName: tagName,
                type: type,
                createTime: doc.publishDate || doc.createTime || '未知日期',
                category: doc.category || {}
              };
            });
            
            that.setData({
              latestDocuments: formattedDocuments
            });
            console.log('获取最新文档成功，文档数量:', formattedDocuments.length);
            resolve(formattedDocuments);
          } else {
            console.error('获取文档失败:', res);
            that.setData({ latestDocuments: [] });
            resolve([]);
          }
        },
        fail: err => {
          console.error('调用云函数失败:', err);
          that.setData({ latestDocuments: [] });
          reject(err);
        }
      });
    });
  },



  /**
   * 跳转到文档详情页
   */
  navigateToDetail: function(e) {
    const doc = e.currentTarget.dataset.doc;
    if (doc && doc.id) {
      wx.navigateTo({
        url: `/pages/document-view/document-view?id=${doc.id}`
      });
    } else {
      wx.showToast({
        title: '文档信息不完整',
        icon: 'none'
      });
    }
  },

  /**
   * 查看全部文档
   */
  viewAllDocuments: function() {
    wx.navigateTo({
      url: '/pages/documents/documents'
    });
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function() {
    console.log('首页隐藏');
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function() {
    // 页面卸载时的清理逻辑
    console.log('首页页面卸载');
    
    // 移除文档更新事件监听器
    this.removeDocumentUpdateListener();
  },
  
  /**
   * 注册文档更新事件监听器
   */
  registerDocumentUpdateListener: function() {
    const that = this;
    
    // 监听文档列表更新事件
    this.documentUpdateCallback = function(data) {
      console.log('首页收到文档更新事件:', data);
      
      // 强制刷新文档列表
      that.getLatestDocuments(true);
    };
    
    // 注册事件监听器
    getApp().on('documentListUpdated', this.documentUpdateCallback);
    console.log('首页已注册文档更新事件监听器');
  },
  
  /**
   * 移除文档更新事件监听器
   */
  removeDocumentUpdateListener: function() {
    if (this.documentUpdateCallback) {
      getApp().off('documentListUpdated', this.documentUpdateCallback);
      this.documentUpdateCallback = null;
      console.log('首页已移除文档更新事件监听器');
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function() {
    console.log('触发下拉刷新');
    
    // 显示加载动画
    wx.showNavigationBarLoading();
    
    // 重新加载最新文档数据
    this.getLatestDocuments().then(() => {
      // 数据加载完成后停止下拉刷新动画
      wx.hideNavigationBarLoading();
      wx.stopPullDownRefresh();
      
      // 显示刷新成功提示
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    }).catch(error => {
      console.error('下拉刷新失败:', error);
      
      // 停止下拉刷新动画
      wx.hideNavigationBarLoading();
      wx.stopPullDownRefresh();
      
      // 显示刷新失败提示
      wx.showToast({
        title: '刷新失败',
        icon: 'none',
        duration: 1500
      });
    });
  }
});