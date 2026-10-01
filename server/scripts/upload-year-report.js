#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const { S3Storage } = require('coze-coding-dev-sdk')

const FILE_PATH = '/workspace/projects/docs/report/simulation-year-iter-2026.html'
const FILE_NAME = `reports/simulation-year-iter-2026_${Date.now().toString(36)}.html`

async function main() {
  const storage = new S3Storage({
    endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
    accessKey: '',
    secretKey: '',
    bucketName: process.env.COZE_BUCKET_NAME,
    region: 'cn-beijing',
  })

  const buf = fs.readFileSync(FILE_PATH)
  const fileKey = await storage.uploadFile({
    fileContent: buf,
    fileName: FILE_NAME,
    contentType: 'text/html; charset=utf-8',
  })
  console.log('uploaded key:', fileKey)

  const url = await storage.generatePresignedUrl({
    key: fileKey,
    expireTime: 30 * 24 * 60 * 60,
  })
  console.log('public url (30d):', url)
  console.log('size:', buf.length, 'bytes')
}

main().catch((e) => {
  console.error('upload failed:', e)
  process.exit(1)
})