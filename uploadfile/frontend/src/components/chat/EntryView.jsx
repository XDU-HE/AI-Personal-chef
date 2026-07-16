import { Clock3, Leaf, Refrigerator } from "lucide-react";
import { useId } from "react";

export const DEFAULT_STARTER_PROMPTS = [
  {
    id: "quick-dinner",
    title: "15 分钟快手晚餐",
    description: "适合忙碌工作日后的健康美味",
    value: "请推荐一道 15 分钟内能完成的快手晚餐。",
    icon: Clock3,
  },
  {
    id: "fridge-only",
    title: "只用冰箱现有食材",
    description: "零浪费的高级料理创意",
    value: "请只用我冰箱里现有的食材推荐菜谱。",
    icon: Refrigerator,
  },
  {
    id: "high-protein",
    title: "低油高蛋白建议",
    description: "科学减脂与美味的完美平衡",
    value: "请推荐低油、高蛋白的健康菜谱。",
    icon: Leaf,
  },
];

export function EntryView({
  prompts = DEFAULT_STARTER_PROMPTS,
  onPromptSelect,
  plateAlt = "摆盘精致的健康料理",
  className = "",
}) {
  const descriptionId = useId();

  return (
    <section className={`ai-entry ${className}`.trim()} aria-labelledby={`${descriptionId}-title`}>
      <div className="ai-entry__content">
        <div className="ai-entry__copy">
          <span className="ai-entry__kicker">INSPIRATION</span>
          <h2 id={`${descriptionId}-title`} className="ai-entry__title">
            家里有什么，<br />今晚就吃什么。
          </h2>
          <p className="ai-entry__description">
            描述您的食材、口味或饮食限制，AI 私厨助手为您即时定制米其林级的烹饪方案。
          </p>
        </div>

        <div className="ai-entry__prompts" aria-label="灵感建议">
          {prompts.map((prompt, index) => {
            const Icon = prompt.icon;
            const promptDescriptionId = `${descriptionId}-prompt-${index}`;

            return (
              <button
                key={prompt.id || prompt.title}
                type="button"
                className="ai-entry__prompt"
                aria-describedby={promptDescriptionId}
                onClick={() => onPromptSelect?.(prompt)}
              >
                <span className="ai-entry__prompt-icon" aria-hidden="true">
                  {Icon ? <Icon /> : null}
                </span>
                <span className="ai-entry__prompt-copy">
                  <span className="ai-entry__prompt-title">{prompt.title}</span>
                  <span id={promptDescriptionId} className="ai-entry__prompt-description">
                    {prompt.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ai-entry__visual">
        <div className="ai-entry__plate-glow" aria-hidden="true" />
        <img
          className="ai-entry__plate"
          src="/culinary-plate.jpg"
          alt={plateAlt}
          fetchPriority="high"
        />
      </div>
    </section>
  );
}
