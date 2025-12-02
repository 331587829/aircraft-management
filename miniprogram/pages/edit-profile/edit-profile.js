// pages/edit-profile/edit-profile.js
const app = getApp()

Page({
  /**
   * 页面的初始数据
   */
  data: {
    userInfo: {
      avatar: '',
      nickName: '',
      companyName: '', // 新增公司名称
      phoneNumber: '', // 手机号码
      hasBoundAircraft: false,
      memberLevel: '',
      serviceLevel: '',
      boundAircraftCount: 0,
      aircraftStatus: {
        active: 0
      }
    },
    saving: false,
    // 表单验证状态
    validationErrors: {},
    // 是否显示字段提示
    showFieldTips: false,
    // 是否显示手机号码授权按钮
    showPhoneAuthButton: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    this.loadUserInfo();
    // 不再自动获取用户信息，改为手动获取
    // this.autoGetUserInfo();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    // 不再需要地区显示更新
  },

  /**
   * 手动获取微信用户信息
   */
  getUserProfile: function() {
    const that = this;
    
    // 安全检查：确保globalData.userInfo.wechatInfo存在
    if (!app.globalData.userInfo || !app.globalData.userInfo.wechatInfo) {
      console.log('用户信息结构不完整，初始化数据结构');
      app.globalData.userInfo = {
        wechatInfo: {},
        hasBoundAircraft: false,
        boundAircraftCount: 0,
        aircraftStatus: { active: 0 }
      };
    }
    
    const wechatInfo = app.globalData.userInfo.wechatInfo;
    
    console.log('手动获取微信用户信息');
    
    // 获取用户基本信息
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        console.log('获取用户基本信息成功:', res);
        
        // 将微信头像的临时本地路径上传到云存储
        that.uploadAvatarToCloud(res.userInfo.avatarUrl, (cloudUrl) => {
          // 更新头像和昵称
          that.setData({
            'userInfo.avatar': cloudUrl,
            'userInfo.nickName': res.userInfo.nickName
          });
          
          // 使用统一方法更新全局数据
          app.updateUserInfo({
            wechatInfo: {
              avatarUrl: cloudUrl,
              nickName: res.userInfo.nickName
            }
          });
          
          // 如果没有手机号，显示手机号授权按钮
          if (!wechatInfo.phoneNumber) {
            that.setData({
              showPhoneAuthButton: true
            });
          }
          
          wx.showToast({
            title: '获取成功',
            icon: 'success'
          });
        });
      },
      fail: (err) => {
        console.error('获取用户基本信息失败:', err);
        // 失败时也显示手机号授权按钮（如果还没有手机号）
        if (!wechatInfo.phoneNumber) {
          that.setData({
            showPhoneAuthButton: true
          });
        }
        
        wx.showToast({
          title: '获取失败，请重试',
          icon: 'none'
        });
      }
    });
  },

  /**
   * 加载用户信息
   */
  loadUserInfo: function() {
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({
        userInfo: {
          avatar: userInfo.wechatInfo?.avatarUrl || '/images/user-avatar.png',
          nickName: userInfo.wechatInfo?.nickName || '微信用户',
          companyName: userInfo.companyName || '',
          phoneNumber: userInfo.phoneNumber || '',
          hasBoundAircraft: userInfo.hasBoundAircraft || false,
          memberLevel: userInfo.memberLevel || '普通会员',
          serviceLevel: userInfo.serviceLevel || '标准服务',
          boundAircraftCount: userInfo.boundAircraftCount || 0,
          aircraftStatus: userInfo.aircraftStatus || { active: 0 }
        },
        showPhoneAuthButton: !userInfo.phoneNumber // 如果没有手机号码，显示授权按钮
      })
    }
  },

  /**
   * 返回上一页
   */
  goBack: function() {
    wx.navigateBack()
  },

  /**
   * 保存个人信息
   */
  saveProfile: function() {
    const userInfo = this.data.userInfo
    
    // 验证必填字段
    if (!userInfo.nickName.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      })
      return
    }

    // 添加保存按钮加载状态
    this.setData({
      saving: true
    })

    // 调用云函数保存到数据库
    this.saveToDatabase(userInfo)
  },

  /**
   * 保存到数据库
   */
  saveToDatabase: function(userInfo) {
    wx.showLoading({
      title: '保存中...'
    })

    // 准备要保存的数据
    const userDataToSave = {
      ...app.globalData.userInfo,
      wechatInfo: {
        ...app.globalData.userInfo.wechatInfo,
        avatarUrl: userInfo.avatar,
        nickName: userInfo.nickName,
      },
      companyName: userInfo.companyName,
      phoneNumber: userInfo.phoneNumber
    };

    wx.cloud.callFunction({
      name: 'bindUserInfo',
      data: {
        userInfo: userDataToSave,
        type: 'profile' // 指定这是个人信息编辑类型
      },
      success: (res) => {
        wx.hideLoading()
        wx.showToast({
          title: '保存成功',
          icon: 'success',
          duration: 2000
        })
        
        // 移除保存按钮加载状态
        this.setData({
          saving: false
        })
        
        // 更新本地存储和全局数据
        app.updateUserInfo(userDataToSave);
        
        // 延迟返回，让用户看到保存成功的提示
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'none'
        })
        
        // 移除保存按钮加载状态
        this.setData({
          saving: false
        })
        
        console.error('保存用户信息失败:', err)
      }
    })
  },

  /**
   * 选择头像
   */
  onChooseAvatar: function(e) {
    const { avatarUrl } = e.detail
    const that = this
    
    // 将选择的头像上传到云存储
    this.uploadAvatarToCloud(avatarUrl, (cloudUrl) => {
      that.setData({
        'userInfo.avatar': cloudUrl
      })
      
      // 立即更新全局数据和本地存储
      app.updateUserInfo({
        wechatInfo: {
          avatarUrl: cloudUrl
        }
      });
    })
  },

  /**
   * 昵称输入处理
   */
  onNicknameInput: function(e) {
    const value = e.detail.value;
    this.setData({
      'userInfo.nickName': value
    });
    
    // 清除该字段的错误信息
    if (this.data.validationErrors.nickName) {
      this.setData({
        'validationErrors.nickName': ''
      });
    }
  },

  /**
   * 公司名称输入处理
   */
  onCompanyNameInput: function(e) {
    const value = e.detail.value;
    this.setData({
      'userInfo.companyName': value
    });
    
    // 清除该字段的错误信息
    if (this.data.validationErrors.companyName) {
      this.setData({
        'validationErrors.companyName': ''
      });
    }
  },

  /**
   * 验证昵称
   */
  validateNickname: function(nickName) {
    let validationErrors = this.data.validationErrors
    
    if (!nickName) {
      validationErrors.nickName = '昵称不能为空'
    } else if (nickName.length < 2) {
      validationErrors.nickName = '昵称至少需要2个字符'
    } else if (nickName.length > 20) {
      validationErrors.nickName = '昵称不能超过20个字符'
    } else {
      delete validationErrors.nickName
    }
    
    this.setData({
      validationErrors: validationErrors
    })
    
    return !validationErrors.nickName
  },

  /**
   * 获取焦点时显示字段提示
   */
  onFieldFocus: function(e) {
    this.setData({
      showFieldTips: true
    })
  },

  /**
   * 失去焦点时隐藏字段提示
   */
  onFieldBlur: function(e) {
    this.setData({
      showFieldTips: false
    })
  },



  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {

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
   * 将头像上传到云存储
   */
  uploadAvatarToCloud: function(localAvatarUrl, callback) {
    // 如果是云存储路径，直接返回
    if (localAvatarUrl.startsWith('cloud://')) {
      callback(localAvatarUrl);
      return;
    }
    
    // 如果是本地临时路径，直接上传到云存储
    const timestamp = new Date().getTime();
    const cloudPath = `avatars/${timestamp}_${Math.random().toString(36).substring(2, 15)}.jpg`;
    
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: localAvatarUrl,
      success: (res) => {
        console.log('头像上传到云存储成功:', res);
        callback(res.fileID);
      },
      fail: (err) => {
        console.error('头像上传到云存储失败:', err);
        // 上传失败时，使用默认头像
        callback('/images/user-avatar.png');
      }
    });
  },

  /**
   * 获取手机号码
   */
  getPhoneNumber: function(e) {
    const { code } = e.detail
    
    if (code) {
      wx.showLoading({
        title: '获取手机号码中...'
      })
      
      // 调用云函数解密手机号码
      wx.cloud.callFunction({
        name: 'decryptPhoneNumber',
        data: {
          code: code
        },
        success: (res) => {
          if (res.result && res.result.success) {
            const phoneNumber = res.result.phoneNumber
            this.setData({
              'userInfo.phoneNumber': phoneNumber,
              showPhoneAuthButton: false
            })
            
            // 立即更新全局数据和本地存储
            app.globalData.userInfo.wechatInfo.phoneNumber = phoneNumber
            app.globalData.userInfo.phoneNumber = phoneNumber
            // 修复：保存完整的userInfo对象
            wx.setStorage({
              key: 'userInfo',
              data: app.globalData.userInfo
            })
            
            // 触发全局事件，通知其他页面用户信息已更新
            app.emit('userInfoUpdated', app.globalData.userInfo)
            
            wx.showToast({
              title: '获取手机号码成功',
              icon: 'success'
            })
          } else {
            wx.showToast({
              title: res.result.error || '获取手机号码失败',
              icon: 'none'
            })
          }
        },
        fail: (err) => {
          console.error('调用云函数失败:', err)
          wx.showToast({
            title: '获取手机号码失败',
            icon: 'none'
          })
        },
        complete: () => {
          wx.hideLoading()
        }
      })
    } else {
      wx.showToast({
        title: '获取手机号码失败',
        icon: 'none'
      })
    }
  }
})