// app/api/recipes-web/check/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { dishName, cuisineName } = await request.json();

    if (!dishName || !cuisineName) {
      return NextResponse.json(
        { success: false, message: "菜名和菜系为必填项" },
        { status: 400 }
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
      { status: 500 }
    );
  }
}

// 这是一个示例函数，需要根据你的数据库实现
async function checkRecipeInDatabase(
  dishName: string,
  cuisineName: string
): Promise<boolean> {
  try {
    // 示例：连接到你的云数据库并查询
    // 以下是伪代码，需要根据你实际的数据库进行修改
    
    // 如果使用 MongoDB
    // const db = await connectDatabase();
    // const recipe = await db.collection('recipes_web').findOne({
    //   dishName: dishName,
    //   cuisineName: cuisineName
    // });
    // return !!recipe;

    // 如果使用 Supabase
    // const { data } = await supabase
    //   .from('recipes_web')
    //   .select('id')
    //   .eq('dishName', dishName)
    //   .eq('cuisineName', cuisineName)
    //   .single();
    // return !!data;

    // 如果使用其他数据库，按照相应的方式实现查询逻辑
    
    // 这里返回 false 作为示例
    return false;
  } catch (error) {
    console.error("数据库查询出错：", error);
    return false;
  }
}
