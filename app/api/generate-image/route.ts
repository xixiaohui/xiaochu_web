/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { app } from "@/lib/cloudbase";


export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = String(body?.prompt || "").trim();

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: "prompt 不能为空" },
        { status: 400 }
      );
    }

    // 可选：限制长度，防止滥用
    if (prompt.length > 500) {
      return NextResponse.json(
        { success: false, error: "prompt 过长" },
        { status: 400 }
      );
    }

    const res = await app.callFunction({
      name: "generateImage-hcRFc8",
      data: {
        prompt,
        ...body,
      },
    });

    return NextResponse.json({
      success: true,
      data: res.result,
    });
  } catch (error: any) {
    console.error("generate-image api error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "生成失败",
      },
      { status: 500 }
    );
  }
}