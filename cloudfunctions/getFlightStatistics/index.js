const cloud = require('wx-server-sdk');
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 获取飞机飞行统计信息
 * @param {string} aircraftId 飞机ID
 */
exports.main = async (event, context) => {
  const { aircraftId } = event;
  
  try {
    // 查询该飞机的飞行记录
    const flightRecords = await db.collection('flight_records')
      .where({
        aircraftId: aircraftId
      })
      .orderBy('startTime', 'desc')
      .get();

    // 计算统计信息
    let totalFlights = 0;
    let totalHours = 0;
    let lastFlightDate = null;
    let recentFlights = 0; // 最近30天飞行次数
    let currentMonthFlights = 0; // 本月飞行次数
    let currentMonthHours = 0; // 本月飞行时长

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    if (flightRecords.data && flightRecords.data.length > 0) {
      totalFlights = flightRecords.data.length;
      
      flightRecords.data.forEach(record => {
        // 处理飞行时长
        if (record.duration) {
          const duration = parseFloat(record.duration) || 0;
          totalHours += duration;
        }
        
        // 处理飞行日期 - 支持两种格式
        let flightDate = null;
        if (record.endTime) {
          // 新格式：使用 endTime
          flightDate = new Date(record.endTime);
        } else if (record.flightDate) {
          // 旧格式：使用 flightDate
          flightDate = new Date(record.flightDate);
        }
        
        if (flightDate) {
          // 更新最后飞行日期
          if (!lastFlightDate || flightDate > lastFlightDate) {
            lastFlightDate = flightDate;
          }
          
          // 统计最近30天飞行次数
          if (flightDate >= thirtyDaysAgo) {
            recentFlights++;
          }
          
          // 统计本月飞行次数和时长
          if (flightDate >= currentMonthStart) {
            currentMonthFlights++;
            if (record.duration) {
              currentMonthHours += parseFloat(record.duration) || 0;
            }
          }
        }
      });
    }

    // 获取飞机基本信息
    const aircraftInfo = await db.collection('aircrafts')
      .doc(aircraftId)
      .get();

    return {
      success: true,
      data: {
        aircraftId: aircraftId,
        totalFlights: totalFlights,
        totalHours: parseFloat(totalHours.toFixed(2)),
        lastFlightDate: lastFlightDate ? lastFlightDate.toISOString() : null,
        recentFlights: recentFlights, // 最近30天飞行次数
        currentMonthFlights: currentMonthFlights, // 本月飞行次数
        currentMonthHours: parseFloat(currentMonthHours.toFixed(2)), // 本月飞行时长
        aircraftInfo: aircraftInfo.data || {}
      }
    };
    
  } catch (error) {
    console.error('获取飞行统计失败:', error);
    return {
      success: false,
      message: '获取飞行统计失败',
      error: error.message
    };
  }
};