// pages/my-journey/my-journey.js
const app = getApp();

Page({
  data: {
    // 用户信息
    userInfo: {
        nickName: '',
        avatar: '/images/user-avatar.png',
        hasBoundAircraft: false,
      },
    
    // 统计概览数据
    statistics: {
      totalFlights: 0,
      totalHours: 0,
      currentMonthFlights: 0,
      currentMonthHours: 0
    },
    
    // 最近三条飞行记录
    recentFlightRecords: [],
    
    // 成就数据
    achievements: [],
    unlockedAchievements: 0,
    totalAchievements: 0,
    
    // 加载状态
    isLoading: true,
    hasError: false,
    errorMessage: '',
    
    // 数据更新时间
    lastUpdateTime: '',
    
    // 数据缓存状态
    hasInitialData: false, // 标记是否已有初始数据
    
    // 飞机选择相关
    selectedAircraftId: '', // 当前选中的飞机ID
    selectedAircraftIndex: 0, // 当前选中的飞机索引
    selectedAircraftName: '', // 当前选中的飞机名称
    aircraftOptions: [], // 飞机选择选项
    selectedAircraftData: null // 当前选中飞机的详细统计数据
  },

  onLoad: function(options) {
    console.log('我的旅程页面加载');
    
    // 监听飞行记录添加事件，当添加飞行记录后自动刷新数据
    const app = getApp();
    this.onFlightRecordAdded = (data) => {
      console.log('接收到飞行记录添加事件，刷新数据');
      this.initPage(0);
    };
    app.on('flightRecordAdded', this.onFlightRecordAdded);
    
    // 监听飞机列表更新事件，当绑定或解绑飞机后自动刷新数据
    this.onAircraftListUpdated = (data) => {
      console.log('接收到飞机列表更新事件，刷新数据');
      this.initPage(0);
    };
    app.on('aircraftListUpdated', this.onAircraftListUpdated);
    
    this.initPage(0);
  },

  onShow: function() {
    console.log('我的旅程页面显示');
    
    // 检查是否需要重新加载数据
    const currentTime = Date.now();
    const lastLoadTime = this.lastLoadTime || 0;
    const timeDiff = currentTime - lastLoadTime;
    
    // 如果距离上次加载超过5分钟，或者数据为空，才重新加载
    if (!this.data.hasInitialData || timeDiff > 5 * 60 * 1000) {
      console.log('需要重新加载数据，时间间隔:', timeDiff, 'ms');
      this.initPage(0);
    } else {
      console.log('数据已缓存，跳过重新加载');
      // 确保页面显示正确的加载状态
      this.setData({ 
        isLoading: false,
        hasError: false
      });
    }
  },

  // 初始化页面
  initPage: function(retryCount = 0) {
    const MAX_RETRY_COUNT = 5; // 减少重试次数，避免长时间等待
    
    return new Promise((resolve, reject) => {
      // 获取全局 app 对象
      const app = getApp();
      
      // 先设置加载状态
      this.setData({ 
        isLoading: true, 
        hasError: false,
        errorMessage: ''
      });
      
      // 检查用户信息是否存在，如果不存在则立即初始化默认值
      if (!app.globalData.userInfo) {
        console.log('用户信息未初始化，立即初始化默认值');
        app.globalData.userInfo = {
          wechatInfo: {},
          hasBoundAircraft: false,
          aircraftList: []
        };
      }
      
      const userInfo = app.globalData.userInfo;
      console.log('用户信息状态:', userInfo);
      
      // 直接加载飞行统计数据，不等待用户认证状态
      console.log('开始加载飞行统计数据');
      this.setData({ userInfo });
      this.loadFlightStatisticsData()
        .then(() => {
          // 标记数据已加载完成
          this.setData({
            hasInitialData: true
          });
          this.lastLoadTime = Date.now();
          
          resolve();
        })
        .catch((error) => {
          console.error('加载飞行统计数据失败:', error);
          
          // 即使数据加载失败，也显示页面，但提示用户
          this.setData({ 
            isLoading: false, 
            hasError: true,
            errorMessage: '数据加载失败，请检查网络连接'
          });
          resolve();
        });
    });
  },

  // 加载飞行统计数据（并行优化版本）
  loadFlightStatisticsData: function() {
    console.log('开始并行加载飞行统计数据');
    
    // 检查是否正在加载，避免重复加载
    if (this.isLoadingData) {
      console.log('数据正在加载中，跳过重复请求');
      return Promise.resolve();
    }
    
    this.isLoadingData = true;
    
    // 设置加载状态
    this.setData({ 
      isLoading: true, 
      hasError: false,
      errorMessage: '',
      partialLoading: {
        aircraftStats: true,
        recentRecords: true,
        achievements: true
      }
    });
    
    return new Promise((resolve, reject) => {
      // 并行执行三个数据加载任务
      const aircraftStatsPromise = this.loadAircraftStats();
      const recentRecordsPromise = this.getRecentFlightRecords();
      const achievementsPromise = this.getAchievements();
      
      // 使用 Promise.allSettled 等待所有任务完成，无论成功或失败
      Promise.allSettled([aircraftStatsPromise, recentRecordsPromise, achievementsPromise])
        .then(results => {
          const [aircraftResult, recentResult, achievementsResult] = results;
          let hasCriticalError = false;
          let errorMessages = [];
          
          // 处理飞机统计数据结果
          if (aircraftResult.status === 'fulfilled') {
            console.log('飞机统计数据加载成功');
            this.setData({
              'partialLoading.aircraftStats': false
            });
          } else {
            console.error('飞机统计数据加载失败:', aircraftResult.reason);
            errorMessages.push('飞机统计数据加载失败');
            hasCriticalError = true;
          }
          
          // 处理最近飞行记录结果
          if (recentResult.status === 'fulfilled') {
            console.log('最近飞行记录加载成功');
            this.setData({
              'partialLoading.recentRecords': false
            });
          } else {
            console.error('最近飞行记录加载失败:', recentResult.reason);
            errorMessages.push('飞行记录加载失败');
          }
          
          // 处理成就数据结果
          if (achievementsResult.status === 'fulfilled') {
            console.log('成就数据加载成功');
            this.setData({
              'partialLoading.achievements': false
            });
          } else {
            console.error('成就数据加载失败:', achievementsResult.reason);
            errorMessages.push('成就数据加载失败');
          }
          
          // 更新最终状态
          this.setData({
            isLoading: false,
            hasError: hasCriticalError,
            errorMessage: hasCriticalError ? errorMessages.join('，') : ''
          });
          
          // 重置加载状态
          this.isLoadingData = false;
          
          if (hasCriticalError) {
            reject(new Error(errorMessages.join('，')));
          } else {
            resolve();
          }
        })
        .catch(error => {
          console.error('并行加载过程中发生错误:', error);
          this.setData({ 
            isLoading: false, 
            hasError: true,
            errorMessage: '数据加载过程中发生错误'
          });
          
          // 重置加载状态
          this.isLoadingData = false;
          reject(error);
        });
    });
  },

  // 加载飞机统计数据（独立方法）
  loadAircraftStats: function() {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getAircraftStats',
        data: {}
      })
      .then(res => {
        console.log('获取飞机统计数据成功:', res);
        
        let selectedAircraftId = '';
        let selectedAircraftIndex = 0;
        let selectedAircraftName = '';
        let aircraftOptions = [];
        let selectedAircraftData = null;
        
        if (res.result && res.result.success) {
          const aircraftStatsResult = res.result.data;
          const summary = aircraftStatsResult.summary;
          const aircraftStats = aircraftStatsResult.aircraftStats;
          
          // 生成飞机选择选项
          if (aircraftStats && aircraftStats.length > 0) {
            // 生成飞机选择列表
            aircraftOptions = aircraftStats.map(aircraft => ({
              id: aircraft.aircraftId,
              name: `${aircraft.serialNumber} (${aircraft.model})`,
              value: aircraft.aircraftId
            }));
            
            // 设置默认选中的飞机
            selectedAircraftId = aircraftStats[0].aircraftId;
            selectedAircraftData = aircraftStats[0];
            selectedAircraftIndex = 0;
            selectedAircraftName = aircraftOptions[0].name;
          }
          
          // 直接使用云函数返回的本月飞行数据
          const currentMonthFlights = summary.currentMonthFlights || 0;
          const currentMonthHours = summary.currentMonthHours || 0;
          
          // 更新页面数据 - 确保数据结构正确
          this.setData({
            statistics: {
              totalFlights: summary.totalFlights || 0,
              totalHours: summary.totalFlightHours || 0,
              currentMonthFlights: currentMonthFlights,
              currentMonthHours: currentMonthHours,
              aircraftCount: summary.totalAircrafts || 0,
              aircraftStats: aircraftStats || []
            },
            aircraftOptions: aircraftOptions,
            selectedAircraftId: selectedAircraftId,
            selectedAircraftIndex: selectedAircraftIndex,
            selectedAircraftName: selectedAircraftName,
            selectedAircraftData: selectedAircraftData
          });
        }
        resolve();
      })
      .catch(error => {
        console.error('加载飞机统计数据失败:', error);
        reject(error);
      });
    });
  },

  // 获取飞行统计概览（简化版，直接返回基本统计数据）
  getFlightStatistics: function() {
    return Promise.resolve({
      totalFlights: 0,
      totalDuration: 0,
      averageDuration: 0,
      aircraftCount: 0,
      aircraftStats: []
    });
  },







  // 获取最近飞行记录（并行优化版本）
  getRecentFlightRecords: function(limit = 2) {
    const that = this;
    return new Promise((resolve) => {
      // 直接调用云函数获取飞行记录
      const app = getApp();
      const userInfo = app.globalData.userInfo;
      
      // 准备调用参数，包含用户信息
      const callData = { limit };
      if (userInfo && userInfo.wechatInfo && userInfo.wechatInfo.openid) {
        callData.userInfo = {
          openId: userInfo.wechatInfo.openid
        };
      }
      
      wx.cloud.callFunction({
        name: 'getRecentFlightRecords',
        data: callData
      })
      .then(res => {
        const cloudRecords = (res.result && res.result.success) ? (res.result.data || []) : [];
        console.log('云端返回的飞行记录:', cloudRecords);
        
        // 处理云端记录：直接使用云函数返回的格式化数据
        const cloudList = (cloudRecords || []).map(r => {
          console.log('单条云端记录详情:', r);
          
          return {
            id: r.id,
            aircraftId: r.aircraftId,                    // 飞机的序列号
            departureTime: r.startTimeStr || '未知时间',   // 云函数返回的格式化时间
            arrivalTime: r.endTimeStr || '未知时间',       // 云函数返回的格式化时间
            date: r.flightDate || '',                     // 云函数返回的格式化日期
            duration: r.duration || 0,                    // 飞行时长（小时）
            source: 'cloud'
          };
        });

        const localRecords = wx.getStorageSync('flightRecords') || [];
          console.log('本地飞行记录:', localRecords);
          
          // 处理本地记录
          const localList = localRecords.map(r => {
            let dateStr = '';
            let departureTimeStr = '未知时间';
            let arrivalTimeStr = '未知时间';
            
            try {
              // 日期处理
              if (r.endTime) {
                const endDate = new Date(r.endTime);
                if (!isNaN(endDate.getTime())) {
                  dateStr = `${endDate.getFullYear()}-${this.formatTime(endDate.getMonth() + 1)}-${this.formatTime(endDate.getDate())}`;
                }
              }
              
              // 出发时间处理
              if (r.startTime) {
                const startDate = new Date(r.startTime);
                if (!isNaN(startDate.getTime())) {
                  const hours = startDate.getHours().toString().padStart(2, '0');
                  const minutes = startDate.getMinutes().toString().padStart(2, '0');
                  departureTimeStr = `${hours}:${minutes}`;
                }
              }
              
              // 到达时间处理
              if (r.endTime) {
                const endDate = new Date(r.endTime);
                if (!isNaN(endDate.getTime())) {
                  const hours = endDate.getHours().toString().padStart(2, '0');
                  const minutes = endDate.getMinutes().toString().padStart(2, '0');
                  arrivalTimeStr = `${hours}:${minutes}`;
                }
              }
            } catch (e) {
              console.error('本地记录时间格式化错误:', e);
            }
            
            return {
              ...r,
              departureTime: departureTimeStr,
              arrivalTime: arrivalTimeStr,
              date: dateStr,
              source: 'local'
            };
          });

          const inProgress = wx.getStorageSync('inProgressFlight');
          const inProgressList = inProgress ? [{
            id: 'in_progress',
            aircraftId: inProgress.aircraftId,
            aircraftModel: inProgress.model,
            startTime: inProgress.startTime,
            endTime: null,
            departureTime: this.formatTimestamp(inProgress.startTime),
            arrivalTime: '进行中',
            duration: 0,
            date: '',
            inProgress: true,
            source: 'local'
          }] : [];

          // 合并所有记录
          const allRecords = [...inProgressList, ...cloudList, ...localList];
          console.log('合并后的所有记录:', allRecords);
          
          // 按时间排序（最新的在前）
          allRecords.sort((a, b) => {
            // 处理云端记录的新字段名和本地记录的旧字段名
            let timeA, timeB;
            
            // 对于云端记录，使用格式化后的时间字符串
            if (a.source === 'cloud') {
              timeA = a.arrivalTime || a.departureTime;
            } else {
              timeA = a.endTime || a.arrivalTime || a.startTime || a.departureTime;
            }
            
            if (b.source === 'cloud') {
              timeB = b.arrivalTime || b.departureTime;
            } else {
              timeB = b.endTime || b.arrivalTime || b.startTime || b.departureTime;
            }
            
            // 如果时间格式是HH:MM，需要转换为可比较的时间戳
            if (typeof timeA === 'string' && timeA.includes(':')) {
              timeA = this.convertTimeToTimestamp(timeA, a.date);
            }
            
            if (typeof timeB === 'string' && timeB.includes(':')) {
              timeB = this.convertTimeToTimestamp(timeB, b.date);
            }
            
            return new Date(timeB) - new Date(timeA);
          });
          
          // 只显示前2条记录（排除"进行中"记录）
          const displayRecords = allRecords.filter(record => !record.inProgress).slice(0, 2);
          
          // 如果有"进行中"记录，添加到显示列表的开头（但只显示最新的1条）
          const inProgressRecords = allRecords.filter(record => record.inProgress);
          if (inProgressRecords.length > 0) {
            // 只显示最新的1条进行中记录
            const latestInProgress = inProgressRecords[0];
            displayRecords.unshift(latestInProgress);
          }
          
          // 更新页面数据
          this.setData({
            recentFlightRecords: displayRecords
          });
          
          // 返回所有记录
          resolve(allRecords);
        })
        .catch(err => {
          console.error('获取最近飞行记录失败', err);
          const inProgress = wx.getStorageSync('inProgressFlight');
          const fallback = inProgress ? [{
            id: 'in_progress',
            aircraftId: inProgress.aircraftId,
            aircraftModel: inProgress.model,
            startTime: inProgress.startTime,
            endTime: null,
            departureTime: this.formatTimestamp(inProgress.startTime),
            arrivalTime: '进行中',
            duration: 0,
            inProgress: true,
            source: 'local'
          }] : [];
          
          // 只显示前2条记录
          const displayFallback = fallback.slice(0, 2);
          
          // 更新页面数据（使用降级数据）
          this.setData({
            recentFlightRecords: displayFallback
          });
          
          resolve(fallback);
        });
    });
  },

  // 获取成就数据（并行优化版本）
  getAchievements: function() {
    return new Promise((resolve, reject) => {
      // 从数据库获取真实成就数据
      wx.cloud.callFunction({
        name: 'getAchievements',
        data: {}
      }).then(res => {
        console.log('获取成就数据成功', res);
        if (res.result && res.result.success) {
          const achievements = res.result.data || [];
          
          // 转换成就数据格式，将 title 转换为 name
          const formattedAchievements = achievements.map(achievement => ({
            ...achievement,
            name: achievement.title || achievement.name
          }));
          
          // 更新页面数据
          this.setData({
            achievements: formattedAchievements,
            unlockedAchievements: formattedAchievements.filter(ach => ach.achieved).length,
            totalAchievements: formattedAchievements.length,
            lastUpdateTime: this.formatCurrentTime()
          });
          
          resolve(achievements);
        } else {
          // 如果获取失败，返回空数组
          this.setData({
            achievements: [],
            unlockedAchievements: 0,
            totalAchievements: 0,
            lastUpdateTime: this.formatCurrentTime()
          });
          resolve([]);
        }
      }).catch(err => {
        console.error('调用获取成就数据云函数失败', err);
        // 出错时返回空数组
        this.setData({
          achievements: [],
          unlockedAchievements: 0,
          totalAchievements: 0,
          lastUpdateTime: this.formatCurrentTime()
        });
        resolve([]);
      });
    });
  },





















  // 随机颜色生成器
  getRandomColor: function() {
    const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#d35400', '#c0392b'];
    return colors[Math.floor(Math.random() * colors.length)];
  },

  // 格式化当前时间
  formatCurrentTime: function() {
    const now = new Date();
    const year = now.getFullYear();
    const month = this.formatTime(now.getMonth() + 1);
    const day = this.formatTime(now.getDate());
    const hour = this.formatTime(now.getHours());
    const minute = this.formatTime(now.getMinutes());
    return `${year}-${month}-${day} ${hour}:${minute}`;
  },

  // 格式化时间
  formatTime: function(time) {
    return time < 10 ? '0' + time : time;
  },

  // 格式化时间戳（将Unix时间戳转换为HH:MM格式）
  formatTimestamp: function(timestamp) {
    if (!timestamp) return '';
    
    // 如果是字符串格式的时间戳，转换为数字
    const timeNum = typeof timestamp === 'string' ? parseInt(timestamp) : timestamp;
    
    // 检查时间戳是否合理（在1970-2100年之间）
    if (timeNum < 0 || timeNum > 4102444800000) {
      return '';
    }
    
    const date = new Date(timeNum);
    const hours = this.formatTime(date.getHours());
    const minutes = this.formatTime(date.getMinutes());
    return `${hours}:${minutes}`;
  },

  // 将HH:MM格式的时间转换为时间戳
  convertTimeToTimestamp: function(timeStr, dateStr) {
    if (!timeStr || !dateStr) return 0;
    
    try {
      // 解析时间字符串
      const [hours, minutes] = timeStr.split(':').map(Number);
      
      // 解析日期字符串
      const [year, month, day] = dateStr.split('-').map(Number);
      
      // 创建日期对象
      const date = new Date(year, month - 1, day, hours, minutes);
      
      return date.getTime();
    } catch (error) {
      console.error('时间转换错误:', error);
      return 0;
    }
  },

  // 下拉刷新
  onPullDownRefresh: function() {
    console.log('下拉刷新触发');
    // 强制重新获取最新的用户信息
    app.globalData.userInfo = null;
    // 重新初始化页面
    this.initPage()
      .then(() => {
        wx.stopPullDownRefresh();
      })
      .catch((error) => {
        console.error('下拉刷新失败:', error);
        wx.stopPullDownRefresh();
      });
  },





  // 重新加载数据
  reloadData: function() {
    console.log('重新加载数据');
    this.initPage();
  },

  // 重新加载按钮点击事件
  onRetryLoad: function() {
    console.log('点击重新加载按钮');
    this.initPage();
  },
  
  // 飞机选择变化事件
  onAircraftChange: function(e) {
    console.log('飞机选择变化:', e.detail.value);
    const selectedAircraftIndex = e.detail.value;
    
    // 获取选中的飞机选项
    const selectedOption = this.data.aircraftOptions[selectedAircraftIndex];
    if (!selectedOption) return;
    
    const selectedAircraftId = selectedOption.value;
    
    // 查找选中的飞机数据
    const selectedAircraftData = this.data.statistics.aircraftStats.find(aircraft => aircraft.aircraftId === selectedAircraftId);
    
    // 更新选中的飞机数据
    this.setData({
      selectedAircraftIndex: selectedAircraftIndex,
      selectedAircraftId: selectedAircraftId,
      selectedAircraftName: selectedOption.name,
      selectedAircraftData: selectedAircraftData
    });
    
    // 重新加载最近飞行记录，根据选中的飞机进行过滤
    this.loadRecentFlightRecords();
  },
  
  // 加载最近飞行记录（根据选中的飞机进行过滤）
  loadRecentFlightRecords: function() {
    this.getRecentFlightRecords(10) // 获取更多记录以便过滤
      .then(records => {
        // 如果有选中飞机，过滤该飞机的记录
        let filteredRecords = records;
        if (this.data.selectedAircraftId && this.data.selectedAircraftId !== 'all') {
          filteredRecords = records.filter(record => record.aircraftId === this.data.selectedAircraftId);
        }
        
        // 只显示前2条记录
        const displayRecords = filteredRecords.slice(0, 2);
        
        // 更新最近飞行记录
        this.setData({
          recentFlightRecords: displayRecords
        });
        
        console.log('更新后的最近飞行记录:', displayRecords);
      })
      .catch(error => {
        console.error('加载最近飞行记录失败:', error);
      });
  },
  
  // 页面卸载时移除事件监听
  onUnload: function() {
    console.log('我的旅程页面卸载');
    // 移除事件监听，避免内存泄漏
    const app = getApp();
    if (this.onFlightRecordAdded) {
      app.off('flightRecordAdded', this.onFlightRecordAdded);
    }
    if (this.onAircraftListUpdated) {
      app.off('aircraftListUpdated', this.onAircraftListUpdated);
    }
  },




});
