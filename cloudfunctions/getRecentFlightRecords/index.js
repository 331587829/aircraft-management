// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const { limit = 10 } = event
    
    // 获取用户的 openid
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    
    // 如果用户未登录，返回空数据而不是错误
    if (!openid) {
      console.log('用户未登录，返回空数据')
      return {
        success: true,
        data: [],
        message: '用户未登录，返回空数据'
      }
    }
    
    // 查询用户绑定的飞机ID
    const bindResult = await db.collection('user_aircraft_relations')
      .where({
        openid: openid
      })
      .get()
    
    // 过滤有效的绑定关系：isBound为true或者unbindTime为null/undefined
    const validRelations = bindResult.data.filter(relation => {
      return relation.isBound === true || (relation.unbindTime === null || relation.unbindTime === undefined);
    });
    
    if (validRelations.length === 0) {
      return {
        success: true,
        data: [],
        message: '用户未绑定飞机'
      }
    }
    
    const aircraftIds = validRelations.map(binding => binding.aircraftId)
    
    // 查询最近飞行记录 - 按时间排序（优先使用 endTime，其次使用 flightDate）
    const flightRecords = await db.collection('flight_records')
      .where({
        aircraftId: db.command.in(aircraftIds)
      })
      .orderBy('endTime', 'desc')
      .orderBy('flightDate', 'desc')
      .limit(limit)
      .get()
    
    // 格式化返回数据 - 只返回核心信息
    const formattedRecords = flightRecords.data.map(record => {
      // 处理日期
      let flightDate = '未知日期';
      if (record.endTime) {
        // 新格式：使用 endTime
        const date = new Date(record.endTime);
        flightDate = date.toISOString().split('T')[0];
      } else if (record.flightDate) {
        // 旧格式：使用 flightDate
        flightDate = record.flightDate.split(' ')[0];
      }
      
      // 处理开始时间和结束时间
      let startTimeStr = '未知时间';
      let endTimeStr = '未知时间';
      
      if (record.startTime) {
        const startDate = new Date(record.startTime);
        // 云函数运行在UTC时区，需要转换为用户时区（中国标准时间 UTC+8）
        const userStartDate = new Date(startDate.getTime() + 8 * 60 * 60 * 1000);
        const hours = userStartDate.getHours().toString().padStart(2, '0');
        const minutes = userStartDate.getMinutes().toString().padStart(2, '0');
        startTimeStr = `${hours}:${minutes}`;
      }
      
      if (record.endTime) {
        const endDate = new Date(record.endTime);
        // 云函数运行在UTC时区，需要转换为用户时区（中国标准时间 UTC+8）
        const userEndDate = new Date(endDate.getTime() + 8 * 60 * 60 * 1000);
        const hours = userEndDate.getHours().toString().padStart(2, '0');
        const minutes = userEndDate.getMinutes().toString().padStart(2, '0');
        endTimeStr = `${hours}:${minutes}`;
      }
      
      return {
        id: record._id,
        date: flightDate,
        startTime: startTimeStr,
        endTime: endTimeStr,
        aircraftId: record.aircraftId, // 飞机的序列号，用于识别每架飞机的数据
        duration: record.duration || 0 // 飞行时长（小时）
      }
    })
    
    return {
      success: true,
      data: formattedRecords,
      message: '获取成功'
    }
    
  } catch (error) {
    console.error('获取飞行记录失败:', error)
    return {
      success: false,
      message: '获取飞行记录失败: ' + error.message,
      data: []
    }
  }
}