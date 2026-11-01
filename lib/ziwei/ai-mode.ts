'use client';

/**
 * lib/ziwei/ai-mode —— 客户端读服务端当前是「模型解读」还是「本地查表」
 *
 * 两种模式对用户的意义不一样，文案不能写死：
 *
 *   model：服务端配了模型，出生信息会发到模型服务，解读是模型讲出来的。
 *   local：纯本地查表，不出网、不消耗 token。
 *
 * 拿不到状态就当 local —— 保守的说法总比把「不出网」说错强。
 */
import { useEffect, useState } from 'react';

export type AiMode = 'model' | 'local';

export interface AiStatus {
  mode: AiMode;
  dataset: boolean;
}

export function useAiMode(): AiStatus {
  const [status, setStatus] = useState<AiStatus>({ mode: 'local', dataset: true });

  useEffect(() => {
    let alive = true;
    fetch('/api/ai-status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { mode?: string; dataset?: boolean } | null) => {
        if (!alive || !data) return;
        setStatus({
          mode: data.mode === 'model' ? 'model' : 'local',
          dataset: data.dataset !== false,
        });
      })
      .catch(() => { /* 拿不到就按 local 讲 */ });
    return () => { alive = false; };
  }, []);

  return status;
}

/** 解读区底部的说明文案 */
export function aiModeNote(status: AiStatus): string {
  if (status.mode === 'model') {
    return '解读依据来自本地命理数据集，由模型组织成讲解；出生信息会发送到服务端配置的模型服务。';
  }
  if (!status.dataset) {
    return '本地解读数据集未安装，只能量盘。装好数据集后这里会出现断语解读。';
  }
  return '本地解读数据集查表，非 AI 对话：按命盘已有断语与运限四化作答，不消耗 token、不出网。';
}
