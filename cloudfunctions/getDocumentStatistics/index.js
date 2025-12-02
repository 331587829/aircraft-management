const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 获取文档统计信息
exports.main = async (event, context) => {
  try {
    // 获取所有文档
    const allDocuments = await db.collection('documents').get();
    
    // 统计分类分布
    const categoryStats = {};
    
    allDocuments.data.forEach(doc => {
      let categoryName = '';
      
      // 处理不同类型的分类字段
      if (doc.category) {
        if (typeof doc.category === 'string') {
          categoryName = doc.category;
        } else if (typeof doc.category === 'object' && doc.category.name) {
          categoryName = doc.category.name;
        } else if (typeof doc.category === 'object' && doc.category.id) {
          // 根据ID映射到中文名称
          const idMapping = {
            'service_notice': '服务通告',
            'service_letter': '服务信函',
            'news': '新闻资讯',
            'manual': '技术手册',
            'technical-manual': '技术手册',
            'service-letter': '服务信函'
          };
          categoryName = idMapping[doc.category.id] || doc.category.id;
        }
      }
      
      // 如果没有category字段，使用tags字段
      if (!categoryName && doc.tags && doc.tags.length > 0) {
        categoryName = doc.tags[0];
      }
      
      // 如果仍然没有分类，设为未知
      if (!categoryName || categoryName === '0') {
        categoryName = '未知分类';
      }
      
      // 标准化分类名称
      const normalizedCategory = normalizeCategory(categoryName);
      
      if (categoryStats[normalizedCategory]) {
        categoryStats[normalizedCategory]++;
      } else {
        categoryStats[normalizedCategory] = 1;
      }
    });
    
    // 转换为前端需要的格式 - 只保留四个主要类别
    const documentTypes = [
      {
        id: 'notice',
        title: '服务通告',
        icon: '📋',
        description: '飞机维护和服务相关通告',
        count: categoryStats['服务通告'] || 0,
        color: '#4A90E2'
      },
      {
        id: 'letter',
        title: '服务信函',
        icon: '🔧',
        description: '技术服务和操作指导信函',
        count: categoryStats['服务信函'] || 0,
        color: '#50C878'
      },
      {
        id: 'news',
        title: '新闻资讯',
        icon: '📰',
        description: '行业新闻和公司动态',
        count: categoryStats['新闻资讯'] || 0,
        color: '#FF6B6B'
      },
      {
        id: 'manual',
        title: '技术手册',
        icon: '📚',
        description: '操作手册和技术文档',
        count: categoryStats['技术手册'] || 0,
        color: '#9B59B6'
      }
    ];
    
    // 始终返回四个标准类别，即使数量为0
    return {
      success: true,
      data: documentTypes,
      total: allDocuments.data.length,
      message: '获取文档统计成功'
    };
  } catch (error) {
    console.error('获取文档统计失败:', error);
    
    // 直接返回错误信息，不使用模拟数据
    return {
      success: false,
      data: [],
      total: 0,
      message: '获取文档统计失败，请检查网络连接或联系管理员'
    };
  }
};

// 标准化分类名称
function normalizeCategory(categoryName) {
  const mapping = {
    '服务公告': '服务通告',
    '技术通告': '技术手册',
    'technical-manual': '技术手册',
    'service-letter': '服务信函',
    'service_notice': '服务通告'
  };
  
  return mapping[categoryName] || categoryName;
}