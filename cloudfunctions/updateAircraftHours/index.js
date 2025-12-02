// 更新飞机飞行时长的云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

/**
 * 更新飞机飞行时长
 * 在添加飞行记录后调用，更新飞机的总飞行时长
 */
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { aircraftId, duration } = event;
  
  try {
    // 验证用户身份
    if (!wxContext.OPENID) {
      return {
        success: false,
        message: '用户未登录'
      };
    }

    // 验证必填参数
    if (!aircraftId || duration === undefined || duration === null) {
      return {
        success: false,
        message: '缺少必要参数：飞机ID、时长'
      };
    }

    // 验证飞机ID权限（用户必须绑定该飞机）
    const relationCheck = await db.collection('user_aircraft_relations')
      .where({
        openid: wxContext.OPENID,
        aircraftId: aircraftId
      })
      .get();
    
    if (relationCheck.data.length === 0) {
      return {
        success: false,
        message: '无权限更新该飞机的飞行时长'
      };
    }

    // 获取当前飞机信息
    const aircraftResult = await db.collection('aircrafts')
      .where({ _id: aircraftId })
      .get();
    
    if (aircraftResult.data.length === 0) {
      return {
        success: false,
        message: '飞机不存在'
      };
    }

    const aircraft = aircraftResult.data[0];
    const currentTotalHours = aircraft.totalHours || 0;
    const newTotalHours = parseFloat((currentTotalHours + parseFloat(duration)).toFixed(2));

    // 更新飞机总飞行时长
    const updateResult = await db.collection('aircrafts')
      .doc(aircraftId)
      .update({
        data: {
          totalHours: newTotalHours,
          updateTime: db.serverDate()
        }
      });

    console.log('飞机飞行时长更新成功:', updateResult);

    return {
      success: true,
      message: '飞机飞行时长更新成功',
      data: {
        aircraftId: aircraftId,
        previousTotalHours: currentTotalHours,
        newTotalHours: newTotalHours,
        addedHours: parseFloat(duration)
      }
    };
    
  } catch (error) {
    console.error('更新飞机飞行时长失败:', error);
    return {
      success: false,
      message: '更新飞机飞行时长失败',
      error: error.message
    };
  }
};