Page({
  data: {
    keyword: '',
    currentRole: '', // '' | 'admin' | 'user'
    userList: [],
    page: 1,
    pageSize: 20,
    total: 0,
    isLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: true
  },

  onLoad: function (options) {
    this.loadUserList(true);
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value
    });
  },

  // 执行搜索
  onSearch() {
    this.loadUserList(true);
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      keyword: ''
    });
    this.loadUserList(true);
  },

  // 切换角色筛选
  switchRole(e) {
    const role = e.currentTarget.dataset.role;
    if (this.data.currentRole === role) return;
    
    this.setData({
      currentRole: role
    });
    this.loadUserList(true);
  },

  // 加载用户列表
  async loadUserList(reset = false) {
    if (this.data.isLoading || (this.data.isLoadingMore && !reset)) return;

    if (reset) {
      this.setData({
        isLoading: true,
        page: 1,
        userList: [],
        hasMore: true
      });
    } else {
      this.setData({
        isLoadingMore: true
      });
    }

    try {
      const res = await wx.cloud.callFunction({
        name: 'getUserList',
        data: {
          page: this.data.page,
          pageSize: this.data.pageSize,
          keyword: this.data.keyword,
          role: this.data.currentRole
        }
      });

      if (res.result.success) {
        const { list, total } = res.result.data;
        
        // 格式化数据
        const formattedList = list.map(item => ({
          ...item,
          avatarUrl: (item.wechatInfo && item.wechatInfo.avatarUrl) ? item.wechatInfo.avatarUrl : '/images/user-avatar.png',
          createTimeStr: this.formatDate(new Date(item.createTime))
        }));

        const newList = reset ? formattedList : this.data.userList.concat(formattedList);
        
        this.setData({
          userList: newList,
          total: total,
          hasMore: newList.length < total,
          page: this.data.page + 1
        });
      } else {
        wx.showToast({
          title: res.result.message || '加载失败',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('加载用户列表错误:', error);
      wx.showToast({
        title: '加载失败，请重试',
        icon: 'none'
      });
    } finally {
      this.setData({
        isLoading: false,
        isLoadingMore: false,
        isRefreshing: false
      });
    }
  },

  // 下拉刷新
  onRefresh() {
    this.setData({
      isRefreshing: true
    });
    this.loadUserList(true);
  },

  // 加载更多
  loadMore() {
    if (this.data.hasMore && !this.data.isLoadingMore) {
      this.loadUserList(false);
    }
  },

  // 切换用户角色
  toggleRole(e) {
    const { id, isAdmin } = e.currentTarget.dataset;
    const newRole = !isAdmin;
    const actionText = newRole ? '设为管理员' : '降级为普通用户';

    wx.showModal({
      title: '确认操作',
      content: `确定要将该用户${actionText}吗？`,
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '处理中...',
          });

          try {
            const result = await wx.cloud.callFunction({
              name: 'updateUserRole',
              data: {
                userId: id,
                isAdmin: newRole
              }
            });

            if (result.result.success) {
              wx.showToast({
                title: '操作成功',
                icon: 'success'
              });
              
              // 更新本地列表数据
              const updatedList = this.data.userList.map(user => {
                if (user._id === id) {
                  return { ...user, isAdmin: newRole };
                }
                return user;
              });

              this.setData({
                userList: updatedList
              });
            } else {
              wx.showToast({
                title: result.result.message || '操作失败',
                icon: 'none'
              });
            }
          } catch (error) {
            console.error('更新角色失败:', error);
            wx.showToast({
              title: '操作失败，请重试',
              icon: 'none'
            });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  // 格式化日期
  formatDate(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  // 头像加载失败处理
  onAvatarError(e) {
    const index = e.currentTarget.dataset.index;
    const userList = this.data.userList;
    
    if (userList[index]) {
      // 将加载失败的头像替换为默认头像
      const key = `userList[${index}].avatarUrl`;
      this.setData({
        [key]: '/images/user-avatar.png'
      });
    }
  }
});