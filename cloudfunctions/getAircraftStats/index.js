// 获取飞机使用统计数据的云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 获取飞机使用统计数据
 * 统计用户绑定的所有飞机的使用情况
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  
  try {
    // 验证用户身份
    if (!wxContext.OPENID) {
      return {
        success: false,
        message: '用户未登录'
      };
    }

    // 获取用户绑定的飞机列表（只查询当前绑定的飞机）
    const relations = await db.collection('user_aircraft_relations')
      .where({
        openid: wxContext.OPENID,
        isBound: true, // 只查询当前绑定的飞机
        unbindTime: null // 解绑时间为null表示未解绑
      })
      .get();

    if (relations.data.length === 0) {
      return {
        success: true,
        data: {
          aircraftStats: [],
          summary: {
            totalAircrafts: 0,
            totalFlightHours: 0,
            totalFlights: 0,
            averageHoursPerAircraft: 0
          }
        }
      };
    }

    // 获取飞机详细信息
    const aircraftIds = relations.data.map(relation => relation.aircraftId);
    const aircraftsResult = await db.collection('aircrafts')
      .where({
        _id: db.command.in(aircraftIds)
      })
      .get();

    // 获取所有飞机的飞行记录
    const flightRecords = await db.collection('flight_records')
      .where({
        openid: wxContext.OPENID,
        aircraftId: db.command.in(aircraftIds)
      })
      .get();

    // 按飞机ID分组统计飞行数据
    const flightStatsByAircraft = {};
    flightRecords.data.forEach(record => {
      if (!flightStatsByAircraft[record.aircraftId]) {
        flightStatsByAircraft[record.aircraftId] = {
          totalHours: 0,
          totalFlights: 0,
          lastFlightDate: null,
          monthlyHours: 0,
          monthlyFlights: 0,
          weeklyHours: 0
        };
      }
      
      flightStatsByAircraft[record.aircraftId].totalHours += record.duration || 0;
      flightStatsByAircraft[record.aircraftId].totalFlights++;
      
      const recordDate = new Date(record.startTime);
      if (!flightStatsByAircraft[record.aircraftId].lastFlightDate || 
          recordDate > new Date(flightStatsByAircraft[record.aircraftId].lastFlightDate)) {
        flightStatsByAircraft[record.aircraftId].lastFlightDate = record.startTime;
      }
    });

    // 计算本月和本周的飞行时长和飞行次数
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1); // 本月第一天
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 一周前
    
    flightRecords.data.forEach(record => {
      const recordDate = new Date(record.startTime);
      if (recordDate >= monthStart) {
        flightStatsByAircraft[record.aircraftId].monthlyHours += record.duration || 0;
        flightStatsByAircraft[record.aircraftId].monthlyFlights++;
      }
      if (recordDate >= weekAgo) {
        flightStatsByAircraft[record.aircraftId].weeklyHours += record.duration || 0;
      }
    });

    // 构建飞机统计数据
    const aircraftStats = aircraftsResult.data.map(aircraft => {
      const stats = flightStatsByAircraft[aircraft._id] || {
        totalHours: 0,
        totalFlights: 0,
        lastFlightDate: null,
        monthlyHours: 0,
        monthlyFlights: 0,
        weeklyHours: 0
      };
      
      return {
        aircraftId: aircraft._id,
        model: aircraft.model || '未知型号',
        serialNumber: aircraft.serialNumber || '未知序列号',
        deliveryDate: aircraft.deliveryDate || '未知日期',
        totalHours: parseFloat(stats.totalHours.toFixed(2)),
        totalFlights: stats.totalFlights,
        monthlyHours: parseFloat(stats.monthlyHours.toFixed(2)),
        monthlyFlights: stats.monthlyFlights,
        weeklyHours: parseFloat(stats.weeklyHours.toFixed(2)),
        lastFlightDate: stats.lastFlightDate,
        lastFlightDateStr: stats.lastFlightDate ? 
          new Date(stats.lastFlightDate).toLocaleDateString('zh-CN') : '暂无飞行记录',
        averageFlightDuration: stats.totalFlights > 0 ? 
          parseFloat((stats.totalHours / stats.totalFlights).toFixed(2)) : 0,
        utilizationRate: aircraft.totalHours ? 
          parseFloat((stats.totalHours / aircraft.totalHours * 100).toFixed(2)) : 0
      };
    });

    // 计算总体统计
    const totalStats = {
      totalAircrafts: aircraftStats.length,
      totalFlightHours: parseFloat(aircraftStats.reduce((sum, aircraft) => sum + aircraft.totalHours, 0).toFixed(2)),
      totalFlights: aircraftStats.reduce((sum, aircraft) => sum + aircraft.totalFlights, 0),
      currentMonthFlights: aircraftStats.reduce((sum, aircraft) => sum + (aircraft.monthlyFlights || 0), 0),
      currentMonthHours: parseFloat(aircraftStats.reduce((sum, aircraft) => sum + aircraft.monthlyHours, 0).toFixed(2)),
      averageHoursPerAircraft: aircraftStats.length > 0 ? 
        parseFloat((aircraftStats.reduce((sum, aircraft) => sum + aircraft.totalHours, 0) / aircraftStats.length).toFixed(2)) : 0,
      mostUsedAircraft: aircraftStats.length > 0 ? 
        aircraftStats.reduce((max, aircraft) => aircraft.totalHours > max.totalHours ? aircraft : max, aircraftStats[0]) : null,
      recentActivity: aircraftStats.filter(aircraft => aircraft.weeklyHours > 0).length
    };

    // 按使用时长排序
    aircraftStats.sort((a, b) => b.totalHours - a.totalHours);

    return {
      success: true,
      data: {
        aircraftStats: aircraftStats,
        summary: totalStats
      }
    };
    
  } catch (error) {
    console.error('获取飞机使用统计数据失败:', error);
    return {
      success: false,
      message: '获取飞机使用统计数据失败',
      error: error.message
    };
  }
};