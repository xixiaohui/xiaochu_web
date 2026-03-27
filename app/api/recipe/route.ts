import cloudbase from "@cloudbase/js-sdk";

/**
 * 构建用户提示词
 * @param ingredients - 食材列表
 * @param cookTime - 烹饪时间（分钟）
 * @param difficulty - 难度等级
 * @param extraRequirements - 附加要求
 * @returns 用户提示词
 */
const buildUserPrompt = (
  ingredients: string[] | string,
  cookTime: number,
  difficulty: "easy" | "medium" | "hard" | "简单" | "中等" | "困难",
  extraRequirements?: string,
): string => {
  const ingredientsStr = Array.isArray(ingredients)
    ? ingredients.join("、")
    : String(ingredients);

  const difficultyMap: Record<typeof difficulty, string> = {
    easy: "简单",
    medium: "中等",
    hard: "困难",
    简单: "简单",
    中等: "中等",
    困难: "困难",
  };

  const difficultyText = difficultyMap[difficulty] || "简单";

  return `我有以下食材：${ingredientsStr}

请帮我生成一道菜的食谱。
- 烹饪时间要求：${cookTime}分钟以内
- 难度要求：${difficultyText}
- 其他要求：${extraRequirements || "无"}

请直接输出 JSON 格式的食谱，不要有任何其他文字说明。`;
};

export async function POST(req: Request) {
  const { input } = await req.json();

  const app = cloudbase.init({
    env: process.env.VITE_CLOUDBASE_ENV_ID || "",
    region: process.env.VITE_CLOUDBASE_REGION || "",
    accessKey: process.env.VITE_CLOUDBASE_ACCESS_KEY || "",
  });

  const buildSystemPrompt = () => {
    return `你是一位专业的中餐厨师助手，名叫"小厨AI"。你的任务是根据用户提供的食材，快速生成一道美味可口的家常菜食谱。

输出要求：
1. 必须严格以 JSON 格式输出，不要包含任何 Markdown 代码块标记
2. JSON 结构如下：
{
  "name": "菜名",
  "description": "一句话描述这道菜的特点",
  "cookTime": 烹饪时间（分钟，数字类型）,
  "difficulty": "难度（简单/中等/困难）",
  "servings": 份量（人数，数字类型）,
  "ingredients": [
    {"name": "食材名", "amount": "用量", "unit": "单位"}
  ],
  "steps": [
    {"step": 步骤编号（数字）, "description": "步骤说明", "tip": "小贴士（可选，没有则为null）"}
  ],
  "nutrition": {
    "calories": 热量（千卡，数字）,
    "protein": 蛋白质（克，数字）,
    "carbs": 碳水（克，数字）,
    "fat": 脂肪（克，数字）
  },
  "tags": ["标签1", "标签2"]
}
3. 根据用户指定的烹饪时间和难度生成合适的食谱
4. 食谱必须使用用户提供的主要食材，可以补充常见调料
5. 步骤简洁清晰，适合家庭烹饪
6. 仅输出一个可被 JSON.parse 直接解析的 JSON 对象，不要输出任何解释、前缀、后缀或 Markdown 代码块`;
  };

  // // 用户的自然语言输入，如'帮我写一首赞美玉龙雪山的诗'
  // const userInput = "帮我写一首赞美玉龙雪山的诗";

  const res = await app
    .ai()
    .createModel("hunyuan-exp")
    .streamText({
      model: "hunyuan-turbos-latest",
      // model:"hunyuan-t1-latest",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: buildUserPrompt(
            input.ingredients,
            input.cookTime,
            input.difficulty,
            input.extraRequirements,
          ),
        },
      ],
    });

  const stream = new ReadableStream({
    async start(controller) {
      for await (const chunk of res.dataStream) {
        const text = chunk?.choices?.[0]?.delta?.content || "";
        controller.enqueue(new TextEncoder().encode(text));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
