/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  // @mongodb-js/zstd 是原生 addon（预编译 .node），必须留给 Node 运行时加载，不能被打包
  serverExternalPackages: ['@mongodb-js/zstd'],
  // 倪师原话语料：路径是运行时算出来的（NI_CORPUS_PATH / monorepo 上移），
  // 打包器静态追踪不到，所以显式把语料文件带进服务端产物
  outputFileTracingIncludes: {
    '/api/niyu': ['./docs/tianji-ziwei/entries.jsonl'],
    '/niyu': ['./docs/tianji-ziwei/entries.jsonl'],
  },
};

module.exports = nextConfig;
