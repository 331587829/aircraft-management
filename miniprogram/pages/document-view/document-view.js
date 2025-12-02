const { CATEGORY_MAP } = require('../../utils/constants')
Page({
  data: {
    documentId: '',
    documentDetail: null,
    loading: true,
    error: false,
    errorMsg: '',
    contentHtml: '',
    imageAttachments: [],
    fileAttachments: [],
    imagePreviewUrls: [],
    heroCoverUrl: '',
    publishDate: '',
    categoryName: ''
  },

  onLoad: function(options) {
    const { id } = options;
    if (!id) {
      this.setData({ error: true, errorMsg: '信息ID不存在', loading: false });
      return;
    }
    this.setData({ documentId: id });
    this.getDocumentDetail();
  },

  async getDocumentDetail() {
    try {
      this.setData({ loading: true, error: false });
      const res = await wx.cloud.callFunction({ name: 'getDocumentDetail', data: { documentId: this.data.documentId } });
      if (res.result.success) {
        const documentDetail = res.result.document;
        this.setData({ documentDetail, loading: false });
        this.setMetaFields();
        this.prepareContentHtml();
        this.loadAttachmentTempUrls();
      } else {
        throw new Error(res.result.message || '获取信息详情失败');
      }
    } catch (error) {
      console.error('获取信息详情失败:', error);
      this.setData({ error: true, errorMsg: error.message || '网络错误，请重试', loading: false });
    }
  },

  reloadPage() { this.getDocumentDetail(); },

  setMetaFields() {
    const d = this.data.documentDetail || {}
    const pickTs = (t) => {
      if (!t) return null
      if (typeof t === 'object' && t.$date) return t.$date
      const dt = new Date(t)
      return isNaN(dt.getTime()) ? null : dt.getTime()
    }
    const ts = pickTs(d.uploadTime) || pickTs(d.createTime) || pickTs(d.publishDate) || Date.now()
    const date = new Date(ts)
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const da = String(date.getDate()).padStart(2, '0')
    const id = d.categoryId || (typeof d.category === 'string' ? d.category : '')
    const cat = CATEGORY_MAP[id]
    let hero = ''
    const html = String(d.content || '')
    const mimg = html.match(/<img[^>]+src=["']([^"']+)["']/i)
    if (mimg && /^https?:/.test(mimg[1])) hero = mimg[1]
    this.setData({ publishDate: `${y}-${m}-${da}`, categoryName: (cat && cat.name) || (d.category && d.category.name) || '未分类', heroCoverUrl: hero })
  },

  prepareContentHtml() {
    const detail = this.data.documentDetail || {}
    let html = ''
    if (detail.content) {
      html = String(detail.content).replace(/\n/g, '<br/>')
    } else if (detail.description) {
      html = String(detail.description).replace(/\n/g, '<br/>')
    }
    this.setData({ contentHtml: html })
    this.resolveContentImages()
  },

  async resolveContentImages() {
    let html = this.data.contentHtml || ''
    html = html.replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    const srcs = []
    const imgTagRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/ig
    let m
    while ((m = imgTagRegex.exec(html)) !== null) {
      const s = (m[1] || '').trim()
      if (/^cloud:\/\//.test(s)) srcs.push(s)
    }
    if (!srcs.length) return
    try {
      const res = await wx.cloud.getTempFileURL({ fileList: srcs })
      const map = {}
      ;(res.fileList || []).forEach(f => { map[(f.fileID || '').trim()] = f.tempFileURL })
      const replaced = html.replace(/<img([^>]+)src=["']([^"']+)["']([^>]*)>/ig, (all, pre, s, post) => {
        const key = (s || '').trim()
        const url = /^cloud:\/\//.test(key) ? (map[key] || '') : key
        const styled = 'style="max-width:100%;height:auto;border-radius:12rpx"'
        return `<img${pre}src="${url || key}" ${styled}${post}>`
      })
      let hero = this.data.heroCoverUrl
      if (!hero) {
        const m = replaced.match(/<img[^>]+src=["']([^"']+)["']/i)
        if (m && /^https?:/.test(m[1])) hero = m[1]
      }
      this.setData({ contentHtml: replaced, heroCoverUrl: hero })
    } catch (e) {}
  },

  async loadAttachmentTempUrls() {
    const detail = this.data.documentDetail || {}
    const attachments = Array.isArray(detail.attachments) ? detail.attachments : []
    const images = attachments.filter(att => (att.type === 'image' || /image/i.test(att.mime || '')) && (att.cloudPath || att.fileID))
    const files = attachments.filter(att => att.type !== 'image')
    try {
      if (images.length) {
        const fileIDs = images.map(img => img.cloudPath || img.fileID)
        const res = await wx.cloud.getTempFileURL({ fileList: fileIDs })
        const urlMap = {}
        ;(res.fileList || []).forEach((f, idx) => { urlMap[fileIDs[idx]] = f.tempFileURL })
        const imageAttachments = images.map(img => {
          const fid = img.cloudPath || img.fileID
          return { ...img, tempUrl: urlMap[fid] || '' }
        })
        const imagePreviewUrls = imageAttachments.filter(i => i.tempUrl).map(i => i.tempUrl)
        const hero = this.data.heroCoverUrl || (imagePreviewUrls[0] || '')
        this.setData({ imageAttachments, imagePreviewUrls, heroCoverUrl: hero })
      } else {
        this.setData({ imageAttachments: [], imagePreviewUrls: [] })
      }
      this.setData({ fileAttachments: files })
    } catch (e) {
      console.error('获取图片临时URL失败:', e)
      this.setData({ imageAttachments: [], imagePreviewUrls: [], fileAttachments: files })
    }
  },

  onPreviewImage(e) {
    const index = e.currentTarget.dataset.index || 0
    const urls = this.data.imagePreviewUrls || []
    if (!urls.length) return
    wx.previewImage({ current: urls[index], urls })
  },

  onPreviewHero() {
    const url = this.data.heroCoverUrl
    if (!url) return
    wx.previewImage({ current: url, urls: [url] })
  },

  onOpenAttachment(e) {
    const index = e.currentTarget.dataset.index
    const files = this.data.fileAttachments || []
    const file = files[index]
    if (!file || !file.cloudPath) return
    wx.showLoading({ title: '下载中...' })
    wx.cloud.downloadFile({
      fileID: file.cloudPath,
      success: res => { wx.hideLoading(); wx.openDocument({ filePath: res.tempFilePath }) },
      fail: err => { wx.hideLoading(); console.error('附件下载失败:', err); wx.showToast({ title: '下载失败', icon: 'none' }) }
    })
  }
})