// 获取应用实例
const app = getApp();

// 飞行记录页面逻辑
Page({
  data: {
    // 飞机信息
    aircraftInfo: {},
    // 表单数据
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    calculatedDuration: 0,
    flightRemark: '',
    // 最近飞行记录
    recentRecords: [],
    // 页面加载状态
    loading: false
  },

  onLoad: function(options) {
    console.log('飞行记录页面加载，飞机ID:', options.aircraftId);
    
    this.setData({
      aircraftId: options.aircraftId
    });

    // 加载数据
    this.loadData(options.aircraftId);
  },

  // 加载数据
  loadData: function(aircraftId) {
    console.log('加载数据');
    
    // 并行加载飞机信息和最近飞行记录
    Promise.all([
      this.getAircraftInfo(aircraftId),
      this.getRecentFlightRecords(aircraftId)
    ]).then(() => {
      console.log('所有数据加载完成');
    }).catch(error => {
      console.error('数据加载失败:', error);
    });
  },

  // 获取飞机信息
  getAircraftInfo: function(aircraftId) {
    const that = this;
    
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getAircraftInfo',
        data: {
          aircraftId: aircraftId
        },
        success: res => {
          if (res.result.success) {
            const aircraftInfo = res.result.aircraftInfo;
            that.setData({
              aircraftInfo: aircraftInfo
            });
            resolve(aircraftInfo);
          } else {
            const error = new Error(res.result.message || '获取飞机信息失败');
            wx.showToast({
              title: res.result.message || '获取飞机信息失败',
              icon: 'none'
            });
            reject(error);
          }
        },
        fail: err => {
          console.error('获取飞机信息失败:', err);
          wx.showToast({
            title: '网络错误，请稍后重试',
            icon: 'none'
          });
          reject(err);
        }
      });
    });
  },

  // 获取最近飞行记录
  getRecentFlightRecords: function(aircraftId) {
    const that = this;
    
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getRecentFlightRecords',
        data: {
          aircraftId: aircraftId,
          limit: 5 // 获取最近5条记录
        },
        success: res => {
          if (res.result.success) {
            const records = res.result.records || [];
            that.setData({
              recentRecords: records
            });
            resolve(records);
          } else {
            reject(new Error(res.result.message || '获取最近飞行记录失败'));
          }
        },
        fail: err => {
          console.error('获取最近飞行记录失败:', err);
          reject(err);
        }
      });
    });
  },

  // 开始日期选择变化
  onStartDateChange: function(e) {
    this.setData({
      startDate: e.detail.value
    });
    this.calculateDuration();
  },

  // 开始时间选择变化
  onStartTimeChange: function(e) {
    this.setData({
      startTime: e.detail.value
    });
    this.calculateDuration();
  },

  // 结束日期选择变化
  onEndDateChange: function(e) {
    this.setData({
      endDate: e.detail.value
    });
    this.calculateDuration();
  },

  // 结束时间选择变化
  onEndTimeChange: function(e) {
    this.setData({
      endTime: e.detail.value
    });
    this.calculateDuration();
  },

  // 计算飞行时长
  calculateDuration: function() {
    const { startDate, startTime, endDate, endTime } = this.data;
    
    if (startDate && startTime && endDate && endTime) {
      // 组合日期和时间
      const startDateTime = `${startDate} ${startTime}`;
      const endDateTime = `${endDate} ${endTime}`;
      
      const start = new Date(startDateTime.replace(' ', 'T'));
      const end = new Date(endDateTime.replace(' ', 'T'));
      
      if (end > start) {
        const duration = (end - start) / (1000 * 60 * 60); // 转换为小时
        this.setData({
          calculatedDuration: duration.toFixed(1)
        });
      } else {
        this.setData({
          calculatedDuration: 0
        });
        wx.showToast({
          title: '结束时间必须晚于开始时间',
          icon: 'none'
        });
      }
    }
  },

  // 备注输入
  onRemarkInput: function(e) {
    this.setData({
      flightRemark: e.detail.value
    });
  },

  // 提交飞行记录
  submitFlightRecord: function() {
    const that = this;
    
    // 表单验证
    if (!this.validateForm()) {
      return;
    }

    this.setData({
      loading: true
    });

    // 格式化时间参数
    const startDateTime = `${this.data.startDate} ${this.data.startTime}`;
    const endDateTime = `${this.data.endDate} ${this.data.endTime}`;
    const startTime = new Date(startDateTime.replace(' ', 'T')).toISOString();
    const endTime = new Date(endDateTime.replace(' ', 'T')).toISOString();

    wx.cloud.callFunction({
      name: 'addFlightRecord',
      data: {
        aircraftId: this.data.aircraftId,
        duration: parseFloat(this.data.calculatedDuration),
        startTime: startTime,
        endTime: endTime,
        location: '训练基地',
        purpose: '训练飞行',
        notes: this.data.flightRemark
      },
      success: res => {
        console.log('飞行记录添加成功:', res);
        
        if (res.result.success) {
          wx.showToast({
            title: '飞行记录添加成功',
            icon: 'success',
            duration: 2000
          });

          // 飞机总飞行时长已在云函数中更新
          
          // 触发飞行记录添加事件，通知其他页面刷新数据
          const app = getApp();
          app.emit('flightRecordAdded', {
            aircraftId: that.data.aircraftId,
            duration: parseFloat(this.data.calculatedDuration)
          });

          // 延迟返回上一页
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: res.result.message || '添加失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('飞行记录添加失败:', err);
        wx.showToast({
          title: '网络错误，请稍后重试',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({
          loading: false
        });
      }
    });
  },

  // 表单验证
  validateForm: function() {
    const { startDate, startTime, endDate, endTime, calculatedDuration } = this.data;
    
    if (!startDate || !startTime) {
      wx.showToast({
        title: '请选择开始日期和时间',
        icon: 'none'
      });
      return false;
    }

    if (!endDate || !endTime) {
      wx.showToast({
        title: '请选择结束日期和时间',
        icon: 'none'
      });
      return false;
    }

    const start = new Date(`${startDate} ${startTime}`.replace(' ', 'T'));
    const end = new Date(`${endDate} ${endTime}`.replace(' ', 'T'));
    
    if (end <= start) {
      wx.showToast({
        title: '结束时间必须晚于开始时间',
        icon: 'none'
      });
      return false;
    }

    const duration = parseFloat(calculatedDuration);
    if (duration <= 0) {
      wx.showToast({
        title: '飞行时长必须大于0',
        icon: 'none'
      });
      return false;
    }

    if (duration > 24) {
      wx.showToast({
        title: '单次飞行时长不能超过24小时',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  // 更新飞机总飞行时长
  updateAircraftFlightHours: function(duration) {
    wx.cloud.callFunction({
      name: 'updateAircraftHours',
      data: {
        aircraftId: this.data.aircraftId,
        duration: duration
      },
      success: res => {
        console.log('飞机飞行时长更新成功:', res);
      },
      fail: err => {
        console.error('飞机飞行时长更新失败:', err);
      }
    });
  },

  // 返回上一页
  goBack: function() {
    wx.navigateBack();
  }
});