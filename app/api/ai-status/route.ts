/**
 * app/api/ai-status —— 告诉客户端「现在是模型解读还是本地查表」
 *
 * 解读链路有两种模式，客户端得如实告诉用户，因为两者对隐私的影响不同：
 *
 *   model：服务端配了模型（ANTHROPIC_API_KEY 或 ANTHROPIC_AUTH_TOKEN），
 *          出生信息会随请求发到模型服务；解读由模型组织成本地查表没有的表达。
 *   local：纯本地查表，不出网、不消耗 token。
 *
 * 只回模式，不回任何密钥或端点地址。
 */
import { datasetInstalled } from '@/lib/ziwei/dataset';
import { modelEnabled } from '@/lib/ziwei/model';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({
    mode: modelEnabled() ? 'model' : 'local',
    dataset: datasetInstalled(),
  });
}
