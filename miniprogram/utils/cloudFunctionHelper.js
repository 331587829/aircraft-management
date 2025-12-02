/**
 * 云函数调用统一错误处理工具
 * 提供统一的云函数调用接口和错误处理机制
 */

/**
 * 统一的云函数调用方法
 * @param {string} functionName - 云函数名称
 * @param {object} data - 调用参数
 * @param {object} options - 配置选项
 * @returns {Promise} 返回Promise对象
 */
const callCloudFunction = (functionName, data = {}, options = {}) => {
  const {
    showLoading = true, // 是否显示加载提示
    loadingText = '加载中...', // 加载提示文字
    showErrorToast = true, // 是否显示错误提示
    timeout = 10000, // 超时时间（毫秒）
    retryCount = 0, // 重试次数
    retryDelay = 1000 // 重试延迟（毫秒）
  } = options;

  return new Promise((resolve, reject) => {
    // 显示加载提示
    if (showLoading) {
      wx.showLoading({
        title: loadingText,
        mask: true
      });
    }

    // 超时处理
    const timeoutId = setTimeout(() => {
      if (showLoading) {
        wx.hideLoading();
      }
      reject(new Error(`云函数调用超时: ${functionName}`));
    }, timeout);

    // 云函数调用
    wx.cloud.callFunction({
      name: functionName,
      data: data
    }).then(res => {
      clearTimeout(timeoutId);
      
      if (showLoading) {
        wx.hideLoading();
      }

      // 检查云函数返回结果
      if (res.result && res.result.success === false) {
        // 云函数返回错误
        const errorMsg = res.result.message || '云函数执行失败';
        if (showErrorToast) {
          wx.showToast({
            title: errorMsg,
            icon: 'none',
            duration: 2000
          });
        }
        reject(new Error(errorMsg));
        return;
      }

      // 成功返回数据
      resolve(res.result);
    }).catch(err => {
      clearTimeout(timeoutId);
      
      if (showLoading) {
        wx.hideLoading();
      }

      console.error(`云函数调用失败: ${functionName}`, err);
      
      // 错误处理
      let errorMessage = '网络错误，请稍后重试';
      
      if (err.errCode === 'CLOUDFUNCTION_FUNCTION_NOT_EXIST') {
        errorMessage = '功能暂不可用，请联系客服';
      } else if (err.errCode === 'CLOUDFUNCTION_TIMEOUT') {
        errorMessage = '请求超时，请检查网络连接';
      } else if (err.errCode === 'CLOUDFUNCTION_INVOKE_FAILED') {
        errorMessage = '服务异常，请稍后重试';
      } else if (err.errMsg && err.errMsg.includes('request:fail')) {
        errorMessage = '网络连接失败，请检查网络设置';
      }

      if (showErrorToast) {
        wx.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000
        });
      }

      reject(new Error(errorMessage));
    });
  });
};

/**
 * 带重试机制的云函数调用
 * @param {string} functionName - 云函数名称
 * @param {object} data - 调用参数
 * @param {object} options - 配置选项
 * @returns {Promise} 返回Promise对象
 */
const callCloudFunctionWithRetry = async (functionName, data = {}, options = {}) => {
  const { retryCount = 2, retryDelay = 1000 } = options;
  
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const result = await callCloudFunction(functionName, data, {
        ...options,
        showErrorToast: attempt === retryCount // 只在最后一次尝试时显示错误
      });
      return result;
    } catch (error) {
      if (attempt < retryCount) {
        console.log(`第${attempt + 1}次调用失败，${retryDelay}ms后重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        throw error;
      }
    }
  }
};

/**
 * 批量调用云函数
 * @param {Array} functionCalls - 云函数调用配置数组
 * @param {object} options - 配置选项
 * @returns {Promise} 返回Promise对象
 */
const callCloudFunctionsBatch = async (functionCalls, options = {}) => {
  const { showLoading = true, loadingText = '批量处理中...' } = options;
  
  if (showLoading) {
    wx.showLoading({
      title: loadingText,
      mask: true
    });
  }

  try {
    const results = await Promise.all(
      functionCalls.map(call => 
        callCloudFunction(call.functionName, call.data, {
          ...options,
          showLoading: false, // 批量调用时不显示单个加载提示
          showErrorToast: false // 批量调用时不显示单个错误提示
        })
      )
    );

    if (showLoading) {
      wx.hideLoading();
    }

    return results;
  } catch (error) {
    if (showLoading) {
      wx.hideLoading();
    }
    throw error;
  }
};

/**
 * 检查网络连接状态
 * @returns {Promise} 返回网络状态
 */
const checkNetworkStatus = () => {
  return new Promise((resolve, reject) => {
    wx.getNetworkType({
      success: (res) => {
        const networkType = res.networkType;
        if (networkType === 'none') {
          reject(new Error('网络连接不可用'));
        } else {
          resolve(networkType);
        }
      },
      fail: () => {
        reject(new Error('无法获取网络状态'));
      }
    });
  });
};

/**
 * 带网络检查的云函数调用
 * @param {string} functionName - 云函数名称
 * @param {object} data - 调用参数
 * @param {object} options - 配置选项
 * @returns {Promise} 返回Promise对象
 */
const callCloudFunctionWithNetworkCheck = async (functionName, data = {}, options = {}) => {
  try {
    // 检查网络状态
    await checkNetworkStatus();
    
    // 调用云函数
    return await callCloudFunction(functionName, data, options);
  } catch (error) {
    if (options.showErrorToast !== false) {
      wx.showToast({
        title: '网络连接失败，请检查网络设置',
        icon: 'none',
        duration: 2000
      });
    }
    throw error;
  }
};

module.exports = {
  callCloudFunction,
  callCloudFunctionWithRetry,
  callCloudFunctionsBatch,
  checkNetworkStatus,
  callCloudFunctionWithNetworkCheck
};