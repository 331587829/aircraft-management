const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 获取用户飞行成就数据
 * 成就系统包括：
 * 1. 首次飞行成就
 * 2. 飞行时长成就
 * 3. 飞行次数成就
 * 4. 机型收集成就
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;

  try {
    // 获取用户飞行统计数据
    const statsResult = await db.collection('flight_records').aggregate()
      .match({
        openid: openid
      })
      .group({
        _id: null,
        totalFlights: { $sum: 1 },
        totalHours: { $sum: '$duration' },
        uniqueAircraft: { $addToSet: '$aircraftId' }
      })
      .end();

    const stats = statsResult.list && statsResult.list.length > 0 
      ? statsResult.list[0] 
      : { totalFlights: 0, totalHours: 0, uniqueAircraft: [] };

    // 定义成就系统
    const achievements = [
      // 首次飞行成就
      {
        id: 'first_flight',
        title: '首次飞行',
        description: '完成第一次飞行记录',
        icon: '✈️',
        achieved: stats.totalFlights > 0,
        progress: stats.totalFlights > 0 ? 1 : 0,
        target: 1,
        unlockTime: stats.totalFlights > 0 ? new Date().toISOString() : null
      },
      
      // 飞行时长成就
      {
        id: 'flight_hours_10',
        title: '飞行时长达人',
        description: '累计飞行时长达到10小时',
        icon: '⏱️',
        achieved: stats.totalHours >= 10,
        progress: Math.min(stats.totalHours, 10),
        target: 10,
        unlockTime: stats.totalHours >= 10 ? new Date().toISOString() : null
      },
      
      {
        id: 'flight_hours_50',
        title: '资深飞行员',
        description: '累计飞行时长达到50小时',
        icon: '👨‍✈️',
        achieved: stats.totalHours >= 50,
        progress: Math.min(stats.totalHours, 50),
        target: 50,
        unlockTime: stats.totalHours >= 50 ? new Date().toISOString() : null
      },
      
      {
        id: 'flight_hours_100',
        title: '飞行大师',
        description: '累计飞行时长达到100小时',
        icon: '🏆',
        achieved: stats.totalHours >= 100,
        progress: Math.min(stats.totalHours, 100),
        target: 100,
        unlockTime: stats.totalHours >= 100 ? new Date().toISOString() : null
      },
      
      // 飞行次数成就
      {
        id: 'flight_count_5',
        title: '飞行爱好者',
        description: '完成5次飞行记录',
        icon: '📊',
        achieved: stats.totalFlights >= 5,
        progress: Math.min(stats.totalFlights, 5),
        target: 5,
        unlockTime: stats.totalFlights >= 5 ? new Date().toISOString() : null
      },
      
      {
        id: 'flight_count_20',
        title: '飞行达人',
        description: '完成20次飞行记录',
        icon: '🌟',
        achieved: stats.totalFlights >= 20,
        progress: Math.min(stats.totalFlights, 20),
        target: 20,
        unlockTime: stats.totalFlights >= 20 ? new Date().toISOString() : null
      },
      
      {
        id: 'flight_count_50',
        title: '飞行专家',
        description: '完成50次飞行记录',
        icon: '💎',
        achieved: stats.totalFlights >= 50,
        progress: Math.min(stats.totalFlights, 50),
        target: 50,
        unlockTime: stats.totalFlights >= 50 ? new Date().toISOString() : null
      },
      
      // 机型收集成就 - 暂时移除，因为目前只有一个机型
      // {
      //   id: 'aircraft_collector_3',
      //   title: '机型收藏家',
      //   description: '驾驶过3种不同机型',
      //   icon: '🛩️',
      //   achieved: stats.uniqueAircraft.length >= 3,
      //   progress: Math.min(stats.uniqueAircraft.length, 3),
      //   target: 3,
      //   unlockTime: stats.uniqueAircraft.length >= 3 ? new Date().toISOString() : null
      // },
      
      // {
      //   id: 'aircraft_collector_10',
      //   title: '机型大师',
      //   description: '驾驶过10种不同机型',
      //   icon: '🚀',
      //   achieved: stats.uniqueAircraft.length >= 10,
      //   progress: Math.min(stats.uniqueAircraft.length, 10),
      //   target: 10,
      //   unlockTime: stats.uniqueAircraft.length >= 10 ? new Date().toISOString() : null
      // }
    ];

    return {
      success: true,
      message: '获取成就数据成功',
      data: achievements
    };

  } catch (error) {
    console.error('获取成就数据失败:', error);
    
    // 返回默认成就数据（未解锁状态）
    const defaultAchievements = [
      {
        id: 'first_flight',
        title: '首次飞行',
        description: '完成第一次飞行记录',
        icon: '✈️',
        achieved: false,
        progress: 0,
        target: 1,
        unlockTime: null
      },
      {
        id: 'flight_hours_10',
        title: '飞行时长达人',
        description: '累计飞行时长达到10小时',
        icon: '⏱️',
        achieved: false,
        progress: 0,
        target: 10,
        unlockTime: null
      },
      {
        id: 'flight_count_5',
        title: '飞行爱好者',
        description: '完成5次飞行记录',
        icon: '📊',
        achieved: false,
        progress: 0,
        target: 5,
        unlockTime: null
      }
      // 机型收集成就 - 暂时移除，因为目前只有一个机型
      // {
      //   id: 'aircraft_collector_3',
      //   title: '机型收藏家',
      //   description: '驾驶过3种不同机型',
      //   icon: '🛩️',
      //   achieved: false,
      //   progress: 0,
      //   target: 3,
      //   unlockTime: null
      // }
    ];

    return {
      success: true,
      message: '获取成就数据成功（使用默认数据）',
      data: defaultAchievements
    };
  }
};