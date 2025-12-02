const { CATEGORY_MAP } = require('../../utils/constants')

Page({
  data: {
    documentList: [], // 文档列表数据
    category: '', // 当前分类
    categoryId: '', // 当前分类ID
    tags: [], // 文档标签
    pageTitle: '', // 页面标题
    searchQuery: '', // 搜索关键词
    loading: false, // 加载状态
    hasMore: true, // 是否有更多数据
    pageNum: 1, // 当前页码
    pageSize: 10, // 每页数据量
    userRole: 'user', // 用户角色
    hasBoundAircraft: false // 用户是否绑定飞机
  },

  onLoad: function(options) {
    // 从路由参数中获取分类信息、分类ID和搜索关键词
    const { category, categoryId, searchQuery, title, from } = options;
    
    // 解码标题参数，处理URL编码的中文
    const decodedTitle = title ? decodeURIComponent(title) : '';
    
    this.setData({
      category: category || 'all',
      categoryId: categoryId || 'all',
      searchQuery: decodeURIComponent(searchQuery || ''),
      pageTitle: decodedTitle || (category === 'all' ? '全部文档' : category),
      fromManagement: from === 'management' // 是否来自信息管理页面
    });
    
    // 检查用户是否绑定飞机
    this.checkUserAircraftBinding();
    
    // 设置页面标题
    wx.setNavigationBarTitle({
      title: this.data.pageTitle
    });
    
    // 如果是技术通告分类且用户没有绑定飞机，需要权限检查
    if (this.data.categoryId === 'service_bulletin' || this.data.category === '服务通告') {
      if (!this.checkPermissionAndProceed()) {
        return; // 权限不足，停止后续操作
      }
    } else {
      // 其他分类直接获取文档列表
      this.getDocumentsList();
    }
  },

  // 检查用户是否绑定飞机
  checkUserAircraftBinding: function() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.hasBoundAircraft) {
      this.setData({
        hasBoundAircraft: true
      });
    } else {
      this.setData({
        hasBoundAircraft: false
      });
    }
  },

  // 检查权限并继续操作
  checkPermissionAndProceed: function() {
    if (!this.data.hasBoundAircraft) {
      // 延迟显示权限提示，确保页面已经加载
      setTimeout(() => {
        wx.showModal({
          title: '权限不足',
          content: '技术通告仅限VIP机主查看，请先绑定飞机',
          showCancel: false,
          confirmText: '我知道了',
          success: (res) => {
            if (res.confirm) {
              wx.navigateBack();
            }
          }
        });
      }, 500);
      
      // 即使权限不足，也显示空列表而不是白屏
      this.setData({
        documentList: [],
        loading: false,
        hasMore: false
      });
      return false;
    }
    
    // 权限足够，获取文档列表
    this.getDocumentsList();
    return true;
  },

  // 获取文档列表数据
  getDocumentsList: function(append = false) {
    // 如果已经没有更多数据，不再请求
    if (!this.data.hasMore && append) {
      return;
    }
    
    // 设置加载状态
    this.setData({
      loading: true
    });
    
    // 构建请求参数
    const params = {
      page: this.data.pageNum,
      pageSize: this.data.pageSize
    };
    
    // 添加分类ID参数
    if (this.data.categoryId && this.data.categoryId !== 'all') {
      params.categoryId = this.data.categoryId;
    }
    
    // 添加搜索关键词
    if (this.data.searchQuery) {
      params.keyword = this.data.searchQuery;
    }
    
    // 统一使用分类查询云函数
    const functionName = 'getDocumentsByCategory';
    
    // 调用云函数获取文档列表
    wx.cloud.callFunction({
      name: functionName,
      data: params,
      success: res => {
        console.log('获取文档列表成功:', res.result);
        
        if (res.result.success && res.result.data) {
          const newDocs = res.result.data || [];
          const allDocs = append ? [...this.data.documentList, ...newDocs] : newDocs;
          const mappedDocs = allDocs.map(doc => {
            const cat = doc.category
            const id = typeof cat === 'string' ? cat : (cat && cat.id) || ''
            const name = CATEGORY_MAP[id] ? CATEGORY_MAP[id].name : (cat && cat.name) || '未分类'
            return { ...doc, categoryName: name }
          })
          this.setData({
            documentList: mappedDocs,
            hasMore: newDocs.length === this.data.pageSize,
            userRole: res.result.userRole || 'user',
            loading: false
          });
        } else {
          wx.showToast({
            title: res.result.message || '获取文档列表失败',
            icon: 'none'
          });
          this.setData({
            loading: false,
            hasMore: false
          });
        }
      },
      fail: err => {
        console.error('获取文档列表失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
        // 确保页面不会白屏，显示空状态
        this.setData({
          loading: false,
          hasMore: false,
          documentList: [] // 确保有数据，即使是空数组
        });
      }
    });
  },


  // 搜索文档
  onSearch: function(e) {
    const searchQuery = e.detail.value || '';
    this.setData({
      searchQuery: searchQuery,
      pageNum: 1,
      hasMore: true
    });
    
    this.getDocumentsList();
  },


  // 查看文档详情
  viewDocumentDetail: function(e) {
    const documentId = e.currentTarget.dataset.id;
    const document = this.data.documentList.find(doc => doc.id === documentId);
    
    // 检查文档权限
    if (document && document.permissionLevel === 'vip' && !this.data.hasBoundAircraft) {
      wx.showModal({
        title: '权限不足',
        content: '此文档仅限VIP机主查看，请先绑定飞机',
        showCancel: false,
        confirmText: '我知道了'
      });
      return;
    }
    
    wx.navigateTo({
      url: `/pages/document-view/document-view?id=${documentId}`
    });
  },

  // 下载文档
  downloadDocument: function(e) {
    const documentId = e.currentTarget.dataset.id;
    const document = this.data.documentList.find(doc => doc.id === documentId);
    
    if (!document) {
      wx.showToast({
        title: '文档不存在',
        icon: 'none'
      });
      return;
    }
    
    // 检查文档权限
    if (document.permissionLevel === 'vip' && !this.data.hasBoundAircraft) {
      wx.showModal({
        title: '权限不足',
        content: '此文档仅限VIP机主下载，请先绑定飞机',
        showCancel: false,
        confirmText: '我知道了'
      });
      return;
    }
    
    // 处理附件下载
    const attachments = document.attachments || [];
    if (document.fileUrl) {
      this.performDownload(documentId, document.fileUrl);
    } else if (attachments.length > 0) {
      if (attachments.length === 1) {
        this.performDownload(documentId, attachments[0].cloudPath);
      } else {
        // 多个附件，显示选择菜单
        const itemList = attachments.map(item => item.name || '未命名附件');
        wx.showActionSheet({
          itemList: itemList,
          success: (res) => {
            const index = res.tapIndex;
            if (index >= 0 && index < attachments.length) {
              this.performDownload(documentId, attachments[index].cloudPath);
            }
          }
        });
      }
    } else {
      wx.showToast({
        title: '暂无附件可下载',
        icon: 'none'
      });
    }
  },

  // 执行下载
  performDownload: function(documentId, fileUrl) {
    if (!fileUrl) {
      wx.showToast({
        title: '文件链接无效',
        icon: 'none'
      });
      return;
    }

    // 显示下载提示
    wx.showLoading({
      title: '正在下载...',
    });
    
    // 如果是云存储路径，先获取临时链接
    if (fileUrl.startsWith('cloud://')) {
      wx.cloud.getTempFileURL({
        fileList: [fileUrl],
        success: res => {
          if (res.fileList && res.fileList.length > 0 && res.fileList[0].tempFileURL) {
            this.downloadFile(res.fileList[0].tempFileURL);
          } else {
            wx.hideLoading();
            wx.showToast({
              title: '获取文件链接失败',
              icon: 'none'
            });
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('获取临时链接失败', err);
          wx.showToast({
            title: '下载失败',
            icon: 'none'
          });
        }
      });
    } else {
      this.downloadFile(fileUrl);
    }
  },

  // 下载文件
  downloadFile: function(url) {
    wx.downloadFile({
      url: url,
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 200) {
          const filePath = res.tempFilePath;
          wx.openDocument({
            filePath: filePath,
            showMenu: true,
            success: function () {
              console.log('打开文档成功');
            },
            fail: function (err) {
              console.error('打开文档失败', err);
              wx.showToast({
                title: '无法打开此格式文件',
                icon: 'none'
              });
            }
          });
        } else {
          wx.showToast({
            title: '下载失败',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        wx.hideLoading();
        console.error('下载文件失败', err);
        wx.showToast({
          title: '下载失败',
          icon: 'none'
        });
      }
    });
  },

  // 编辑文档
  editDocument: function(e) {
    const documentId = e.currentTarget.dataset.id;
    const document = this.data.documentList.find(doc => doc.id === documentId);
    
    if (!document) {
      wx.showToast({
        title: '文档不存在',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到文档编辑页面
    wx.navigateTo({
      url: `/pages/document-edit/document-edit?id=${documentId}&action=edit&from=management`
    });
  },

  // 删除文档
  deleteDocument: function(e) {
    const documentId = e.currentTarget.dataset.id;
    const document = this.data.documentList.find(doc => doc.id === documentId);
    
    if (!document) {
      wx.showToast({
        title: '文档不存在',
        icon: 'none'
      });
      return;
    }
    
    // 确认删除
    wx.showModal({
      title: '确认删除',
      content: `确定要删除文档"${document.title}"吗？此操作不可恢复。`,
      confirmText: '删除',
      confirmColor: '#ff4757',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.performDeleteDocument(documentId);
        }
      }
    });
  },

  // 执行删除文档操作
  performDeleteDocument: function(documentId) {
    wx.showLoading({
      title: '正在删除...',
    });
    
    wx.cloud.callFunction({
      name: 'deleteDocument',
      data: {
        documentId: documentId
      },
      success: res => {
        wx.hideLoading();
        if (res.result.success) {
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          
          // 从列表中移除已删除的文档
          const newDocumentList = this.data.documentList.filter(doc => doc.id !== documentId);
          this.setData({
            documentList: newDocumentList
          });
          
          // 触发全局事件，通知其他页面更新数据
          const app = getApp();
          const eventData = {
            action: 'delete',
            category: this.data.categoryId
          };
          console.log('document-list页面触发documentListUpdated事件，数据:', eventData);
          console.log('事件系统状态 - 已注册的documentListUpdated监听器数量:', 
            app.globalEventListeners.documentListUpdated ? app.globalEventListeners.documentListUpdated.length : 0);
          
          app.emit('documentListUpdated', eventData);
          console.log('事件已触发，等待监听器响应');
        } else {
          wx.showToast({
            title: res.result.message || '删除失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('删除文档失败:', err);
        wx.showToast({
          title: '删除失败',
          icon: 'none'
        });
      }
    });
  },

  // 加载更多
  onLoadMore: function() {
    if (this.data.hasMore && !this.data.loading) {
      this.setData({
        pageNum: this.data.pageNum + 1
      });
      this.getDocumentsList(true);
    }
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    this.setData({
      pageNum: 1,
      documentList: [],
      hasMore: true
    });
    
    // 直接调用刷新函数，在回调中停止下拉刷新
    this.getDocumentsList();
    
    // 延迟停止下拉刷新，确保数据加载完成
    setTimeout(() => {
      wx.stopPullDownRefresh();
    }, 1000);
  },

  // 页面上拉触底事件
  onReachBottom: function() {
    this.onLoadMore();
  }
});