"use client";

import { useState } from "react";

function Page() {
  const [input, setInput] = useState("");
  const [data, setData] = useState("");

  const getData = async () => {
    const res = fetch("/api/ai", {
      method: "POST",
      body: JSON.stringify({ input }),
    });

    if (!res) {
        setData("请求失败");
    }else{
        const reader = (await res).body?.getReader();
        const decoder = new TextDecoder();
        let result = "";
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;
          result += decoder.decode(value);
          setData(result);
        }
    }

  };

  return (
    <div>
      <input
        value={input}
        placeholder="请输入大模型对话内容"
        onChange={(e) => setInput(e.target.value)}
      />
      <button onClick={getData}>发送</button>
      <p>{data}</p>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
          小厨，您的智能厨房助手
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          小厨是一个基于人工智能的厨房助手，旨在帮助您轻松管理厨房事务。无论是食谱推荐、购物清单生成还是烹饪指导，小厨都能为您提供个性化的建议和支持，让您的厨房生活更加便捷和愉快。
        </p>

        <Page />
      </main>
    </div>
  );
}
