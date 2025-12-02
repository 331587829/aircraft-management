const { CATEGORY_MAP, PERMISSION_MAP } = require('../../utils/constants')

Page({
  data: {
    documents: [],
    activeCategory: 'all',
    loading: false,
    searchQuery: '',
    hasMore: true,
    page: 1,
    pageSize: 15,
    refreshing: false,
    coverLoadBatchSize: 20,
    navs: [
      { id: 'all', name: '全部' },
      { id: 'service_notice', name: '服务通告' },
      { id: 'service_letter', name: '服务信函' },
      { id: 'news', name: '新闻资讯' },
      { id: 'manual', name: '技术手册' }
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
    console.log('资讯页面加载');
    
    // 检查是否有从其他页面传递过来的分类参数
    if (options.category) {
      this.setData({
        activeCategory: options.category
      });
    }
    
    // 注册全局事件监听器
    this.registerEventListeners();
  },
  
  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function() {
    // 移除全局事件监听器
    this.removeEventListeners();
  },
  
  /**
   * 注册全局事件监听器
   */
  registerEventListeners: function() {
    const app = getApp();
    
    // 监听文档列表更新事件
    this.onDocumentListUpdated = (data) => {
      console.log('收到文档列表更新事件，重新加载数据');
      
      // 强制刷新数据
      this.setData({
        page: 1,
        documents: []
      });
      this.getDocuments();
    };
    
    app.on('documentListUpdated', this.onDocumentListUpdated);
  },
  
  /**
   * 移除全局事件监听器
   */
  removeEventListeners: function() {
    const app = getApp();
    
    if (this.onDocumentListUpdated) {
      app.off('documentListUpdated', this.onDocumentListUpdated);
      this.onDocumentListUpdated = null;
    }
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function() {
    console.log('资讯页面显示');
    
    // 每次显示页面时检查数据是否需要刷新
    // 如果距离上次加载超过5分钟，或者数据为空，重新加载
    const currentTime = Date.now();
    const lastLoadTime = this.lastLoadTime || 0;
    const timeDiff = currentTime - lastLoadTime;
    
    if (!this.data.documents || this.data.documents.length === 0 || timeDiff > 5 * 60 * 1000) {
      console.log('资讯页面需要刷新数据');
      this.getDocuments();
    } else {
      console.log('资讯页面数据已缓存，跳过刷新');
    }
  },
  
  // 获取文档列表
  getDocuments: function(cb) {
    this.setData({ loading: true });
    
    const params = {
      categoryId: this.data.activeCategory === 'all' ? 'all' : this.data.activeCategory,
      page: this.data.page,
      pageSize: this.data.pageSize,
      searchQuery: this.data.searchQuery
    };
    
    // 直接调用云函数获取文档列表，不使用缓存
    wx.cloud.callFunction({
      name: 'getDocumentsByCategory',
      data: params
    }).then(res => {
      const docs = res.result.success ? res.result.data : [];
      if (docs && docs.length > 0) {
        const CATEGORY_COVER = {
          service_notice: '/images/category-notice.jpg',
          service_letter: '/images/category-letter.jpg',
          news: '/images/category-news.jpg',
          manual: '/images/category-manual.jpg'
        }
        const normTs = t => {
          if (!t) return undefined
          if (typeof t === 'object' && t.$date) return t.$date
          if (typeof t === 'string') {
            const d = new Date(t)
            if (!isNaN(d.getTime())) return d.getTime()
            return undefined
          }
          return t
        }
        const unified = docs.map(d => {
          const id = d.categoryId || (typeof d.category === 'string' ? d.category : '');
          const cat = CATEGORY_MAP[id] || { name: (d.category && d.category.name) || '未分类', color: '#9B9B9B', icon: '📄' };
          const perm = PERMISSION_MAP[d.permissionLevel] || PERMISSION_MAP.public;
          const ts = normTs(d.uploadTime) || normTs(d.createTime) || normTs(d.publishDate) || normTs(d.createdAt) || normTs(d.updatedAt) || Date.now()
          return {
            ...d,
            categoryName: cat.name,
            categoryColor: cat.color,
            permissionName: perm.name,
            permissionBadge: perm.badge,
            publishDate: typeof d.publishDate === 'string' ? d.publishDate : (
              (() => {
                const dd = new Date(ts)
                if (isNaN(dd.getTime())) return ''
                const y = dd.getFullYear()
                const m = (dd.getMonth() + 1).toString().padStart(2, '0')
                const da = dd.getDate().toString().padStart(2, '0')
                return `${y}-${m}-${da}`
              })()
            ),
            coverUrl: CATEGORY_COVER[id] || '',
            isDefaultCover: true
          };
        });
        const merged = this.data.page === 1 ? unified : [...this.data.documents, ...unified];
        this.setData({ documents: merged, hasMore: docs.length === this.data.pageSize, loading: false }, () => {
          this.lastLoadTime = Date.now();
          this.enrichCovers();
          if (typeof cb === 'function') cb();
        });
      } else {
        this.setData({ documents: [], hasMore: false, loading: false }, () => {
          if (typeof cb === 'function') cb();
        });
      }
    }).catch(err => {
      console.error('获取文档列表失败:', err);
      wx.showToast({
        title: '网络错误，请重试',
        icon: 'none'
      });
      this.setData({
        documents: [],
        hasMore: false,
        loading: false
      });
    });
  },

  // 切换分类
  switchCategory: function(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      activeCategory: category,
      page: 1,
      documents: []
    });
    this.getDocuments();
  },

  // 查看文档详情
  viewDocumentDetail: function(e) {
    const documentId = e.currentTarget.dataset.documentId;
    const documentTitle = e.currentTarget.dataset.documentTitle;
    
    // 跳转到文档详情页面
    wx.navigateTo({
      url: `/pages/document-view/document-view?id=${documentId}&title=${encodeURIComponent(documentTitle)}`
    });
  },

  // 获取分类名称
  getCategoryName: function(category) {
    const id = category
    return (CATEGORY_MAP[id] && CATEGORY_MAP[id].name) || category || '未分类'
  },

  // 获取分类颜色
  getCategoryColor: function(category) {
    const id = category
    return (CATEGORY_MAP[id] && CATEGORY_MAP[id].color) || '#9B9B9B'
  },

  // 格式化时间
  formatTime: function(timestamp) {
    const toDate = (t) => {
      if (!t) return null
      const d = typeof t === 'number' ? new Date(t) : new Date(t)
      return isNaN(d.getTime()) ? null : d
    }
    const date = toDate(timestamp)
    if (!date) return '刚刚'
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minute = 60 * 1000
    const hour = 60 * minute
    const day = 24 * hour
    if (diff < minute) return '刚刚'
    if (diff < hour) return Math.floor(diff / minute) + '分钟前'
    if (diff < day) return Math.floor(diff / hour) + '小时前'
    if (diff < 7 * day) return Math.floor(diff / day) + '天前'
    return (
      date.getFullYear() + '-' +
      (date.getMonth() + 1).toString().padStart(2, '0') + '-' +
      date.getDate().toString().padStart(2, '0')
    )
  },

  // 搜索功能
  onSearch: function(e) {
    const searchQuery = e.detail.value || '';
    this.setData({
      searchQuery: searchQuery,
      page: 1,
      documents: []
    });
    
    // 延迟搜索，避免频繁请求
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.getDocuments();
    }, 500);
  },

  // 上拉加载更多
  onReachBottom: function() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({ page: this.data.page + 1 });
      this.getDocuments();
    }
  },
  onPullDownRefresh: function() {
    this.setData({ refreshing: true, page: 1, documents: [] });
    this.getDocuments(() => {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function() {
    console.log('资讯页面隐藏');
  },

  onReady: function() {
    if (this.data.documents.length) this.enrichCovers();
  },

  // 清除搜索
  clearSearch: function() {
    this.setData({
      searchQuery: '',
      page: 1,
      documents: []
    });
    this.getDocuments();
  },
  enrichCovers: async function() {
    try {
      const docs = this.data.documents
      const need = docs.filter(d => (!d.coverUrl) || d.isDefaultCover).slice(0, this.data.coverLoadBatchSize)
      if (!need.length) return
      
      // 批量获取文档详情
      const detailPromises = need.map(d => wx.cloud.callFunction({ 
        name: 'getDocumentDetail', 
        data: { documentId: d.id } 
      }))
      const details = await Promise.all(detailPromises)
      
      const imageFileIDs = []
      const idToFileID = {}
      
      // 处理每个文档的图片资源
      details.forEach((r, idx) => {
        const doc = need[idx]
        const result = r.result && r.result.document
        
        // 从附件中查找图片
        const attachments = result && Array.isArray(result.attachments) ? result.attachments : []
        const img = attachments.find(a => (
          a.type === 'image' || /image/i.test(a.mime || '')
        ) && (a.cloudPath || a.fileID))
        
        if (img) {
          const fid = img.cloudPath || img.fileID
          imageFileIDs.push(fid)
          idToFileID[doc.id] = fid
          return
        }
        
        // 从富文本中提取首图
        const html = (result && result.content) || ''
        const m = html.match(/<img[^>]+src=["']([^"']+)["']/i)
        if (m && m[1]) {
          const src = m[1]
          if (/^cloud:\/\//.test(src)) {
            imageFileIDs.push(src)
            idToFileID[doc.id] = src
          } else if (/^https?:/.test(src)) {
            // 直接使用 https 图片
            idToFileID[doc.id] = src
          }
        }
      })
      
      // 批量获取临时文件URL
      if (imageFileIDs.length) {
        const urlsRes = await wx.cloud.getTempFileURL({ fileList: imageFileIDs })
        const fileIDToUrl = {}
        ;(urlsRes.fileList || []).forEach(f => { fileIDToUrl[f.fileID] = f.tempFileURL })
        
        // 更新文档数据
        const updated = this.data.documents.map(d => {
          const fid = idToFileID[d.id]
          if (fid) {
            const url = fileIDToUrl[fid] || fid
            if (url) return { ...d, coverUrl: url, isDefaultCover: false }
          }
          return d
        })
        
        this.setData({ documents: updated })
      }
    } catch (e) {
      console.error('封面加载失败', e)
    }
  }
});