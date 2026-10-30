/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['lunar-javascript'],
  // @mongodb-js/zstd 是原生 addon（预编译 .node），必须留给 Node 运行时加载，不能被打包
  serverExternalPackages: ['@mongodb-js/zstd'],
};

module.exports = nextConfig;
