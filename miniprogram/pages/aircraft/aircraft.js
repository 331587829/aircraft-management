// 飞机管理中心页面逻辑

Page({
  data: {
    // 当前显示的飞机数据
    currentAircraft: null,
    // 所有绑定的飞机列表
    aircraftList: [],
    // 当前显示的飞机索引
    currentIndex: 0,
    // 页面加载状态
    loading: false,
    // 是否显示飞机选择器
    showAircraftSelector: false,
    // 飞行记录相关数据
    currentFlightRecord: {
      date: '',
      duration: 0
    },
    isFlightInProgress: false,
    flightStartTime: null
  },

  onLoad: function(options) {
    console.log('飞机页面加载');
    
    // 初始化刷新标记
    this.needRefreshData = false;
    
    // 监听全局飞机数据更新事件
    const app = getApp();
    this.onAircraftListUpdated = (eventData) => {
      console.log('接收到飞机列表更新事件，飞机数量:', eventData ? eventData.count : 0);
      
      // 检查当前页面数据是否与事件数据一致，避免不必要的刷新
      const currentCount = this.data.aircraftList ? this.data.aircraftList.length : 0;
      const eventCount = eventData ? eventData.count : 0;
      
      // 如果数据没有变化，不需要刷新
      if (currentCount === eventCount) {
        console.log('飞机数据没有变化，跳过刷新');
        return;
      }
      
      // 添加防抖机制，避免频繁刷新
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
      }
      this.refreshTimer = setTimeout(() => {
        console.log('触发飞机数据更新');
        // 标记为事件触发，避免循环触发
        this.isEventTriggered = true;
        
        // 设置刷新标记，确保页面显示时重新加载数据
        this.needRefreshData = true;
        console.log('设置数据刷新标记为true');
        
        // 如果页面当前可见，立即更新数据
        if (this.pageVisible) {
          console.log('页面可见，立即更新飞机数据');
          this.loadAircraftData().finally(() => {
            // 数据加载完成后重置标记
            this.isEventTriggered = false;
            this.needRefreshData = false;
          });
        } else {
          console.log('页面不可见，已设置刷新标记，等待页面显示时更新');
          this.isEventTriggered = false;
        }
      }, 300); // 300ms防抖
    };
    app.on('aircraftListUpdated', this.onAircraftListUpdated);
    
    // 监听飞行记录添加事件
    this.onFlightRecordAdded = (flightData) => {
      console.log('接收到飞行记录添加事件，飞机ID:', flightData.aircraftId);
      // 设置刷新标记，当页面显示时重新加载数据
      this.needRefreshData = true;
      console.log('设置数据刷新标记为true');
    };
    app.on('flightRecordAdded', this.onFlightRecordAdded);
    
    // 页面加载时标记为不可见，等待onShow时再加载数据
    this.pageVisible = false;
    console.log('页面加载完成，等待显示时加载数据');
  },

  // 加载飞机数据（直接使用云函数）
  loadAircraftData: function() {
    const that = this;
    
    // 返回Promise以便正确处理异步操作
    return new Promise((resolve, reject) => {
      // 避免重复设置loading状态
      if (!that.data.loading) {
        that.setData({
          loading: true
        });
      }
      
      console.log('开始加载飞机数据...');
      
      // 直接调用云函数获取飞机列表，不使用 dataManager
      wx.cloud.callFunction({
        name: 'getBoundAircraftList'
      }).then(res => {
        const result = res.result;
        if (result && result.success) {
          const aircraftList = result.aircraftList || [];
          console.log('获取到的飞机列表数据:', aircraftList);
      
          if (aircraftList && aircraftList.length > 0) {
            console.log(`找到 ${aircraftList.length} 架绑定的飞机`);
            
            // 格式化飞机数据，确保字段完整
            const formattedAircraftList = aircraftList.map(aircraft => {
              console.log('格式化飞机数据:', aircraft);
              
              // 确保totalHours正确获取
              let totalHours = 0;
              if (aircraft.totalHours !== undefined && aircraft.totalHours !== null) {
                totalHours = parseFloat(aircraft.totalHours);
              } else if (aircraft.totalFlightHours !== undefined && aircraft.totalFlightHours !== null) {
                totalHours = parseFloat(aircraft.totalFlightHours);
              }
              
              // 解决浮点数精度问题
              totalHours = Math.round(totalHours * 100) / 100;
              
              console.log('计算后的totalHours:', totalHours);
              
              return {
                id: aircraft.id || aircraft._id || '',
                model: aircraft.model || 'DL-2L云雁', // 如果没有型号，使用默认型号
                serialNumber: aircraft.serialNumber || '未知序列号',
                deliveryDate: aircraft.deliveryDate || aircraft.year || '未知日期',
                totalHours: totalHours,
                status: aircraft.status || '正常运营',
                statusText: this.getStatusText(aircraft.status),
                statusColor: this.getStatusColor(aircraft.status),
                image: aircraft.image || '/images/aircraft-placeholder.png',
                imageUploaded: aircraft.imageUploaded || false,
                registrationNumber: aircraft.registrationNumber || '',
                yearOfManufacture: aircraft.yearOfManufacture || ''
              };
            });
            
            console.log('格式化后的飞机列表:', formattedAircraftList);
            
            // 更新全局数据，确保其他页面能同步显示
            const app = getApp();
            if (app.globalData.userInfo) {
              // 确保数据结构完整，避免后续使用时报错
              app.globalData.userInfo.aircraftList = aircraftList; // 使用原始数据，避免格式化差异
              app.globalData.userInfo.hasBoundAircraft = aircraftList.length > 0;
              
              console.log('更新全局数据中的飞机列表，数量:', aircraftList.length);
              
              // 只有在不是由事件触发的情况下才触发事件，避免循环触发
              if (!this.isEventTriggered) {
                // 触发事件通知其他页面更新，传递完整信息
                app.emit('aircraftListUpdated', { 
                  aircraftList: aircraftList, 
                  count: aircraftList.length,
                  hasBoundAircraft: aircraftList.length > 0
                });
                console.log('触发aircraftListUpdated事件，通知其他页面更新');
              }
            }
            
            that.setData({
              aircraftList: formattedAircraftList,
              currentAircraft: formattedAircraftList[0], // 默认显示第一架飞机
              currentIndex: 0
            });
            
            // 获取当前飞机的飞行统计数据
            if (formattedAircraftList[0]) {
              that.loadFlightStatistics(formattedAircraftList[0].id);
            }
          } else {
            console.log('没有找到绑定的飞机');
            // 没有绑定飞机的情况
            
            // 更新全局数据为空数组
            const app = getApp();
            if (app.globalData.userInfo) {
              // 确保数据结构完整，避免后续使用时报错
              app.globalData.userInfo.aircraftList = [];
              app.globalData.userInfo.hasBoundAircraft = false;
              console.log('更新全局数据中的飞机列表为空');
              
              // 只有在不是由事件触发的情况下才触发事件，避免循环触发
              if (!this.isEventTriggered) {
                // 触发事件通知其他页面更新，传递完整信息
                app.emit('aircraftListUpdated', { 
                  aircraftList: [], 
                  count: 0,
                  hasBoundAircraft: false
                });
                console.log('触发aircraftListUpdated事件，通知其他页面更新');
              }
            }
            
            that.setData({
              aircraftList: [],
              currentAircraft: null,
              currentIndex: 0
            });
          }
          resolve(aircraftList);
        } else {
          console.error('获取飞机列表失败:', result);
          reject(new Error(result.message || '获取飞机列表失败'));
        }
      }).catch(err => {
        console.error('调用云函数失败:', err);
        reject(err);
      }).finally(() => {
        that.setData({ loading: false });
      });
    });
  },

  onShow: function() {
    console.log('飞机页面显示');
    
    // 标记页面为可见状态
    this.pageVisible = true;
    
    // 检查并恢复飞行状态
    this.checkAndRestoreFlightStatus();
    
    // 智能判断是否需要加载数据
    const app = getApp();
    const hasGlobalData = app.globalData.userInfo && 
                         app.globalData.userInfo.aircraftList && 
                         app.globalData.userInfo.aircraftList.length > 0;
    
    // 如果页面已有数据，检查是否需要刷新
    if (this.data.aircraftList && this.data.aircraftList.length > 0) {
      console.log('页面已有飞机数据，检查是否需要刷新');
      this.updateFlightDisplay();
      
      // 检查是否需要刷新数据（比如从绑定飞机页面返回时）
      if (this.needRefreshData) {
        console.log('检测到需要刷新数据，重新加载飞机数据');
        this.loadAircraftData();
        this.needRefreshData = false; // 重置标记
      } else {
        // 即使页面已有数据，也要检查全局数据是否更新
        // 特别是从绑定飞机页面返回时，全局数据可能已经更新
        if (hasGlobalData && app.globalData.userInfo.aircraftList.length !== this.data.aircraftList.length) {
          console.log('全局数据与页面数据不一致，重新加载数据');
          this.loadAircraftData();
        }
      }
      return;
    }
    
    // 如果全局数据中有数据，使用全局数据更新页面
    if (hasGlobalData) {
      console.log('使用全局数据更新页面显示');
      // 格式化全局数据中的飞机列表，确保格式与页面一致
      const formattedAircraftList = this.formatAircraftList(app.globalData.userInfo.aircraftList);
      this.setData({
        aircraftList: formattedAircraftList,
        currentAircraft: formattedAircraftList[0],
        currentIndex: 0
      });
      
      // 获取当前飞机的飞行统计数据
      if (formattedAircraftList[0]) {
        this.loadFlightStatistics(formattedAircraftList[0].id);
      }
      return;
    }
    
    // 首次显示或数据为空时加载数据
    console.log('首次显示或数据为空，加载飞机数据');
    this.loadAircraftData();
  },

  onHide: function() {
    console.log('飞机页面隐藏');
    // 标记页面为不可见状态
    this.pageVisible = false;
  },

  onUnload: function() {
    this.stopFlightTimer();
    
    // 移除全局事件监听器
    const app = getApp();
    if (this.onAircraftListUpdated) {
      app.off('aircraftListUpdated', this.onAircraftListUpdated);
    }
    if (this.onFlightRecordAdded) {
      app.off('flightRecordAdded', this.onFlightRecordAdded);
    }
  },

  // 获取状态显示文本
  getStatusText: function(status) {
    // 简化状态显示，只保留"运营中"
    return '运营中';
  },

  // 获取状态颜色
  getStatusColor: function(status) {
    // 只返回运营中状态的颜色
    return '#38a169';
  },

  // 格式化飞机列表数据，确保格式与页面一致
  formatAircraftList: function(aircraftList) {
    if (!aircraftList || !Array.isArray(aircraftList)) {
      return [];
    }
    
    console.log('开始格式化飞机列表，原始数据:', aircraftList);
    
    const formattedAircraftList = aircraftList.map(aircraft => {
      console.log('格式化飞机数据:', aircraft);
      
      // 确保totalHours正确获取
      let totalHours = 0;
      if (aircraft.totalHours !== undefined && aircraft.totalHours !== null) {
        totalHours = parseFloat(aircraft.totalHours);
      } else if (aircraft.totalFlightHours !== undefined && aircraft.totalFlightHours !== null) {
        totalHours = parseFloat(aircraft.totalFlightHours);
      }
      
      // 解决浮点数精度问题
      totalHours = Math.round(totalHours * 100) / 100;
      
      console.log('计算后的totalHours:', totalHours);
      
      return {
        id: aircraft.id || aircraft._id || '',
        model: aircraft.model || 'DL-2L云雁', // 如果没有型号，使用默认型号
        serialNumber: aircraft.serialNumber || '未知序列号',
        deliveryDate: aircraft.deliveryDate || aircraft.year || '未知日期',
        totalHours: totalHours,
        status: aircraft.status || '正常运营',
        statusText: this.getStatusText(aircraft.status),
        statusColor: this.getStatusColor(aircraft.status),
        image: aircraft.image || '/images/aircraft-placeholder.png',
        imageUploaded: aircraft.imageUploaded || false,
        registrationNumber: aircraft.registrationNumber || '',
        yearOfManufacture: aircraft.yearOfManufacture || ''
      };
    });
    
    console.log('格式化后的飞机列表:', formattedAircraftList);
    return formattedAircraftList;
  },

  // 切换飞机显示
  switchAircraft: function(e) {
    const index = e.currentTarget.dataset.index;
    if (index >= 0 && index < this.data.aircraftList.length) {
      const selectedAircraft = this.data.aircraftList[index];
      this.setData({
        currentAircraft: selectedAircraft,
        currentIndex: index,
        showAircraftSelector: false
      });
      
      // 加载选中飞机的飞行统计数据
      this.loadFlightStatistics(selectedAircraft.id);
    }
  },

  // 显示/隐藏飞机选择器
  toggleAircraftSelector: function() {
    this.setData({
      showAircraftSelector: !this.data.showAircraftSelector
    });
  },

  // 预览飞机照片
  previewAircraftImage: function() {
    if (!this.data.currentAircraft || !this.data.currentAircraft.image) {
      wx.showToast({
        title: '暂无飞机照片',
        icon: 'none'
      });
      return;
    }

    wx.previewImage({
      current: this.data.currentAircraft.image, // 当前显示图片的http链接
      urls: [this.data.currentAircraft.image] // 需要预览的图片http链接列表
    });
  },



  // 滑动切换飞机
  onSwiperChange: function(e) {
    const current = e.detail.current;
    if (current >= 0 && current < this.data.aircraftList.length) {
      const selectedAircraft = this.data.aircraftList[current];
      this.setData({
        currentAircraft: selectedAircraft,
        currentIndex: current
      });
      
      // 加载选中飞机的飞行统计数据
      this.loadFlightStatistics(selectedAircraft.id);
    }
  },

  // 绑定新飞机
  bindNewAircraft: function() {
    wx.navigateTo({
      url: '/pages/bind-aircraft/bind-aircraft'
    });
  },

  // 添加飞行记录 - 直接在当前页面处理，避免跳转
  addFlightRecord: function() {
    if (!this.data.currentAircraft) {
      wx.showToast({
        title: '请先选择飞机',
        icon: 'none'
      });
      return;
    }

    // 显示添加飞行记录弹窗
    wx.showModal({
      title: '添加飞行记录',
      content: '请选择记录方式',
      cancelText: '手动输入',
      confirmText: '开始计时',
      success: (res) => {
        if (res.confirm) {
          // 开始计时飞行
          this.startFlight();
        } else if (res.cancel) {
          // 跳转到手动输入页面
          wx.navigateTo({
            url: `/pages/flight-record/flight-record?aircraftId=${this.data.currentAircraft.id}`
          });
        }
      }
    });
  },



  // 开始飞行
  startFlight: function() {
    if (!this.data.currentAircraft) {
      wx.showToast({
        title: '请先选择飞机',
        icon: 'none'
      });
      return;
    }

    const currentTime = new Date();
    this.setData({
      isFlightInProgress: true,
      flightStartTime: currentTime,
      currentFlightRecord: {
        date: currentTime.toLocaleDateString(),
        duration: 0,
        durationText: '0秒'
      }
    });

    wx.setStorageSync('flightStartTime', currentTime.getTime());
    wx.setStorageSync('inProgressFlight', {
      aircraftId: this.data.currentAircraft.id,
      serialNumber: this.data.currentAircraft.serialNumber,
      model: this.data.currentAircraft.model,
      startTime: currentTime.getTime()
    });

    wx.showToast({
      title: '飞行开始记录',
      icon: 'success'
    });

    // 启动计时器，每秒更新飞行时长
    this.startFlightTimer();
  },

  // 结束飞行
  endFlight: function() {
    if (!this.data.isFlightInProgress) {
      wx.showToast({
        title: '当前没有进行中的飞行',
        icon: 'none'
      });
      return;
    }

    this.stopFlightTimer();
    
    const endTime = new Date();
    const duration = Math.round((endTime - this.data.flightStartTime) / 1000 / 60 / 60 * 100) / 100; // 计算小时数，保留两位小数

    wx.removeStorageSync('flightStartTime');
    wx.removeStorageSync('inProgressFlight');

    // 保存飞行记录到云端
    this.saveFlightRecord(duration);

    this.setData({
      isFlightInProgress: false,
      flightStartTime: null
    });

    wx.showToast({
      title: `飞行结束，时长: ${duration}小时`,
      icon: 'success'
    });
  },

  // 启动飞行计时器
  startFlightTimer: function() {
    this.flightTimer = setInterval(() => {
      if (this.data.isFlightInProgress && this.data.flightStartTime) {
        const currentTime = new Date();
        // 计算总秒数
        const totalSeconds = Math.floor((currentTime - this.data.flightStartTime) / 1000);
        // 计算小时、分钟、秒
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        // 格式化显示
        let durationText = '';
        if (hours > 0) {
          durationText = `${hours}小时${minutes}分${seconds}秒`;
        } else if (minutes > 0) {
          durationText = `${minutes}分${seconds}秒`;
        } else {
          durationText = `${seconds}秒`;
        }
        
        // 计算小时数（用于记录）
        const duration = Math.round((currentTime - this.data.flightStartTime) / 1000 / 60 / 60 * 100) / 100;
        
        this.setData({
          'currentFlightRecord.duration': duration,
          'currentFlightRecord.durationText': durationText
        });
      }
    }, 1000);
  },

  // 检查并恢复飞行状态（页面显示时调用）
  checkAndRestoreFlightStatus: function() {
    const storedStartTime = wx.getStorageSync('flightStartTime');
    if (storedStartTime) {
      const startTime = new Date(storedStartTime);
      const currentTime = new Date();
      
      // 计算时间差
      const timeDiff = currentTime - startTime;
      
      // 检查时间差是否异常（超过24小时可能是异常数据）
      if (timeDiff > 0 && timeDiff < 24 * 60 * 60 * 1000) { // 24小时内
        // 立即更新一次显示，计算当前飞行时长
        const totalSeconds = Math.floor(timeDiff / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        // 格式化显示
        let durationText = '';
        if (hours > 0) {
          durationText = `${hours}小时${minutes}分${seconds}秒`;
        } else if (minutes > 0) {
          durationText = `${minutes}分${seconds}秒`;
        } else {
          durationText = `${seconds}秒`;
        }
        
        // 计算小时数（用于记录）
        const duration = Math.round(timeDiff / 1000 / 60 / 60 * 100) / 100;
        
        this.setData({
          isFlightInProgress: true,
          flightStartTime: startTime,
          currentFlightRecord: {
            date: startTime.toLocaleDateString(),
            duration: duration,
            durationText: durationText
          }
        });
        
        // 启动计时器
        this.startFlightTimer();
        
        console.log('恢复飞行状态，已飞行时长:', duration, '小时');
      } else {
        // 清除异常的开始时间（超过24小时或无效时间）
        console.log('检测到异常飞行时长，清除飞行状态:', timeDiff / 1000 / 60 / 60, '小时');
        wx.removeStorageSync('flightStartTime');
        wx.removeStorageSync('inProgressFlight');
        this.setData({
          isFlightInProgress: false,
          currentFlightRecord: null
        });
      }
    }
  },

  // 更新飞行显示（不依赖定时器）
  updateFlightDisplay: function() {
    if (this.data.isFlightInProgress && this.data.flightStartTime) {
      const currentTime = new Date();
      // 计算总秒数
      const totalSeconds = Math.floor((currentTime - this.data.flightStartTime) / 1000);
      // 计算小时、分钟、秒
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      // 格式化显示
      let durationText = '';
      if (hours > 0) {
        durationText = `${hours}小时${minutes}分${seconds}秒`;
      } else if (minutes > 0) {
        durationText = `${minutes}分${seconds}秒`;
      } else {
        durationText = `${seconds}秒`;
      }
      
      // 计算小时数（用于记录）
      const duration = Math.round((currentTime - this.data.flightStartTime) / 1000 / 60 / 60 * 100) / 100;
      
      this.setData({
        'currentFlightRecord.duration': duration,
        'currentFlightRecord.durationText': durationText
      });
    }
  },

  // 停止飞行计时器
  stopFlightTimer: function() {
    if (this.flightTimer) {
      clearInterval(this.flightTimer);
      this.flightTimer = null;
    }
  },

  // 保存飞行记录到云端
  saveFlightRecord: function(duration) {
    const that = this;
    
    wx.cloud.callFunction({
      name: 'addFlightRecord',
      data: {
        aircraftId: this.data.currentAircraft.id,
        duration: duration,
        startTime: this.data.flightStartTime.toISOString(),
        endTime: new Date().toISOString()
      },
      success: res => {
        console.log('飞行记录保存成功:', res);
        if (res.result) {
          // 云函数会自动更新总飞行时长，我们只需要刷新数据
          // 重新加载飞机数据以获取最新的总飞行时长
          that.loadAircraftData();
          
          // 触发飞行记录添加事件，通知其他页面刷新数据
          const app = getApp();
          app.emit('flightRecordAdded', {
            aircraftId: that.data.currentAircraft.id,
            duration: duration
          });
        } else {
          console.log('云函数返回结果为空，使用本地存储');
          that.saveFlightRecordLocally(duration);
        }
      },
      fail: err => {
        console.error('飞行记录保存失败:', err);
        if (err.errMsg && err.errMsg.includes('Function not found')) {
          console.log('云函数不存在，使用本地存储');
          that.saveFlightRecordLocally(duration);
        } else {
          wx.showToast({
            title: '记录保存失败，请重试',
            icon: 'none'
          });
        }
      }
    });
  },

  // 本地保存飞行记录（降级方案）
  saveFlightRecordLocally: function(duration) {
    const that = this;
    
    // 获取本地存储的飞行记录
    let flightRecords = wx.getStorageSync('flightRecords') || [];
    
    // 添加新记录
    const newRecord = {
      id: Date.now().toString(),
      aircraftId: this.data.currentAircraft.id,
      aircraftModel: this.data.currentAircraft.model,
      duration: duration,
      startTime: this.data.flightStartTime,
      endTime: new Date(),
      createTime: new Date()
    };
    
    flightRecords.push(newRecord);
    
    // 保存到本地存储
    wx.setStorageSync('flightRecords', flightRecords);
    
    // 更新飞机总飞行时长
    that.updateAircraftFlightHoursLocally(duration);
    
    wx.showToast({
      title: '飞行记录已保存到本地',
      icon: 'success'
    });
  },

  // 本地更新飞机飞行时长（降级方案）
  updateAircraftFlightHoursLocally: function(duration) {
    const that = this;
    
    // 更新当前飞机的总飞行时长
    if (that.data.currentAircraft) {
      const updatedAircraft = {
        ...that.data.currentAircraft,
        totalHours: (that.data.currentAircraft.totalHours || 0) + duration
      };
      
      // 更新当前显示的飞机数据
      that.setData({
        currentAircraft: updatedAircraft
      });
      
      // 更新飞机列表中的对应飞机数据
      const updatedAircraftList = that.data.aircraftList.map(aircraft => {
        if (aircraft.id === updatedAircraft.id) {
          return updatedAircraft;
        }
        return aircraft;
      });
      
      that.setData({
        aircraftList: updatedAircraftList
      });
      
      // 保存到本地存储
      wx.setStorageSync('aircraftList', updatedAircraftList);
      
      wx.showToast({
        title: '飞行时长已更新到本地',
        icon: 'success'
      });
    }
  },

  // 加载飞行统计数据（使用云函数）
  loadFlightStatistics: function(aircraftId) {
    if (!aircraftId) return;
    
    const that = this;
    
    wx.cloud.callFunction({
      name: 'getFlightStatistics',
      data: { aircraftId }
    }).then(res => {
      const stats = res.result && res.result.success ? (res.result.stats || res.result.data || {}) : null;
      if (stats) {
        that.setData({
          monthlyFlightHours: stats.monthlyHours || 0,
          totalFlightHours: stats.totalHours || 0
        });
        
        // 如果统计数据中有总飞行小时，更新当前飞机的显示
        if (stats.totalHours !== undefined && stats.totalHours !== null) {
          const updatedAircraft = {
            ...that.data.currentAircraft,
            totalHours: parseFloat(stats.totalHours)
          };
          that.setData({
            currentAircraft: updatedAircraft
          });
        }
      }
    }).catch(error => {
      console.error('加载飞行统计数据失败:', error);
    });
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function() {
    console.log('触发飞机页面下拉刷新');
    
    // 显示加载动画
    wx.showNavigationBarLoading();
    
    // 重新加载飞机数据
    this.loadAircraftData().then(() => {
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
      console.error('飞机页面下拉刷新失败:', error);
      
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