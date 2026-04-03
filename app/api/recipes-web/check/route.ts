// app/api/recipes-web/check/route.ts
import { app } from "@/lib/cloudbase";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { dishName, cuisineName } = await request.json();

    if (!dishName || !cuisineName) {
      return NextResponse.json(
        { success: false, message: "菜名和菜系为必填项" },
        { status: 400 },
      );
    }

    // 调用你的云数据库 API 或直接查询数据库
    // 这里假设你有一个数据库查询函数
    const exists = await checkRecipeInDatabase(dishName, cuisineName);

    return NextResponse.json({
      success: true,
      exists: exists,
      message: exists ? "菜谱已存在" : "菜谱不存在",
    });
  } catch (error) {
    console.error("检查菜谱出错：", error);
    return NextResponse.json(
      { success: false, message: "检查菜谱出错" },
      { status: 500 },
    );
  }
}

// 这是一个示例函数，需要根据你的数据库实现
async function checkRecipeInDatabase(
  dishName: string,
  cuisineName: string,
): Promise<boolean> {
  try {
    const db = app.database();
    const collection = db.collection("recipes_web");

    // 幂等检查：同一菜系 + 同一来源菜名，只保存一次
    let existed = false;
    try {
      const countRes = await collection
        .where({
          cuisineName: cuisineName || "",
          sourceDishName: dishName,
        })
        .count();

      existed = (countRes?.total || 0) > 0;
    } catch (e) {
      // 如果 count 不可用，不阻断保存
      existed = false;
    }

    if (existed) {
      return true
    }
    return false;
  } catch (error) {
    console.error("数据库查询出错：", error);
    return false;
  }
}
