/* eslint-disable @typescript-eslint/no-explicit-any */
import cloudbase from "@cloudbase/js-sdk";

const VERSION = "web-1.0.0";

type RecipeResult = {
  name: string;
  description: string;
  cookTime: number;
  difficulty: string;
  servings: number;
  ingredients: {
    name: string;
    amount: string;
    unit: string;
  }[];
  steps: {
    step: number;
    description: string;
    tip: string | null;
  }[];
  nutrition: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  tags: string[];
};

type SourcePayload = {
  cuisineId?: string;
  cuisineName?: string;
  cuisineEmoji?: string;
  dishName?: string;
  dishDesc?: string;
  ingredients?: string[];
  cookTime?: number;
  difficulty?: string;
  extraRequirements?: string;
};

export async function POST(req: Request) {
  try {
    const { recipe, source } = (await req.json()) as {
      recipe: RecipeResult;
      source: SourcePayload;
    };

    if (!recipe || !recipe.name) {
      return Response.json(
        { success: false, message: "缺少 recipe 数据" },
        { status: 400 }
      );
    }

    const app = cloudbase.init({
      env: process.env.VITE_CLOUDBASE_ENV_ID || "",
      region: process.env.VITE_CLOUDBASE_REGION || "",
      accessKey: process.env.VITE_CLOUDBASE_ACCESS_KEY || "",
    });

    const db = app.database();
    const collection = db.collection("recipes_web");

    // 幂等检查：同一菜系 + 同一来源菜名，只保存一次
    let existed = false;
    try {
      const countRes = await collection
        .where({
          cuisineId: source?.cuisineId || "",
          sourceDishName: source?.dishName || recipe.name,
        })
        .count();

      existed = (countRes?.total || 0) > 0;
    } catch (e) {
      // 如果 count 不可用，不阻断保存
      existed = false;
    }

    if (existed) {
      return Response.json({
        success: true,
        skipped: true,
        message: "该菜谱已存在，已跳过保存",
      });
    }

    const now =
      typeof db.serverDate === "function" ? db.serverDate() : new Date();

    const record = {
      ...recipe,

      // 来源信息
      cuisineId: source?.cuisineId || "",
      cuisineName: source?.cuisineName || "",
      cuisineEmoji: source?.cuisineEmoji || "",
      category: source?.cuisineName || "",

      sourceType: "web_generated",
      sourceDishName: source?.dishName || recipe.name,
      sourceDishDesc: source?.dishDesc || "",
      sourceIngredients: source?.ingredients || [],
      sourceCookTime: source?.cookTime || recipe.cookTime || 0,
      sourceDifficulty: source?.difficulty || recipe.difficulty || "",
      extraRequirements: source?.extraRequirements || "",

      // AI 信息
      aiProvider: "hunyuan-exp",
      version: VERSION,

      // 状态字段
      status: "active",
      isPublic: true,
      author: "web_user",

      createdAt: now,
      updatedAt: now,
    };

    // 注意：不同 cloudbase SDK 版本 add 参数可能略有区别
    // 如果这里报错，可改成 collection.add(record)
    const addRes = await collection.add({ data: record } as any);

    return Response.json({
      success: true,
      skipped: false,
      id: addRes?.id || null,
      message: "已成功保存到 recipes_web",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "保存到云数据库失败";

    return Response.json(
      {
        success: false,
        message,
      },
      { status: 500 }
    );
  }
}
