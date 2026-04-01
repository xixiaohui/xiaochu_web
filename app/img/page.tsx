/* eslint-disable @typescript-eslint/no-explicit-any */

"use client";

import { useState } from "react";
import Image from "next/image";

export default function Page() {
  const [prompt, setPrompt] = useState("阳光沙滩美女");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!prompt) return;

    setLoading(true);
    setData(null);

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "生成失败");
      }

      if (json.success) {
        setData(json.data);
        console.log("生成结果：", json.data);
      } else {
        alert("生成失败：" + json.message);
      }
    } catch (err: any) {
      alert("请求失败：" + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 40 }}>
      <h1 style={{ fontSize: 24, marginBottom: 20 }}>AI 生图测试页面</h1>

      {/* 输入框 */}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={3}
        style={{
          width: "100%",
          padding: 10,
          fontSize: 16,
          border: "1px solid #ccc",
          borderRadius: 8,
        }}
      />

      {/* 按钮 */}
      <button
        onClick={handleGenerate}
        disabled={loading}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          fontSize: 16,
          background: "#0070f3",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        {loading ? "生成中..." : "生成图片"}
      </button>

      {/* 图片展示 */}
      {data && (
        <div style={{ marginTop: 20 }}>
          <pre>{JSON.stringify(data, null, 2)}</pre>

          {data.imageUrl && (
            <Image
              src={data.imageUrl}
              alt="AI生成图片"
              width={512}
              height={512}
              style={{
                borderRadius: 12,
                marginTop: 10,
                maxWidth: "100%",
                height: "auto",
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

//------------

// "use client";

// import { useState } from "react";
// import Image from "next/image";

// export default function Page() {
//   const [prompt, setPrompt] = useState("一只可爱的猫咪在阳光下玩耍");
//   const [data, setData] = useState<any>(null);
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");

//   const getData = async () => {
//     try {
//       setLoading(true);
//       setError("");

//       // 调用 generateImage-hcRFc8 云函数
//       const res = await fetch("/api/generate-image", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           prompt,
//         }),
//       });

//       const json = await res.json();

//       if (!res.ok || !json.success) {
//         throw new Error(json.error || "生成失败");
//       }

//       setData(json.data);

//     } catch (e: any) {
//       setError(e.message || "调用失败");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div style={{ padding: 24 }}>
//       <button onClick={getData} disabled={loading}>
//         {loading ? "生成中..." : "调用云函数生成图片"}
//       </button>

//       {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}

//       {data && (
//         <div style={{ marginTop: 16 }}>
//           <pre>{JSON.stringify(data, null, 2)}</pre>

//           {/* 假设你的云函数返回 { imageUrl: "https://..." } */}
//           {data.imageUrl && (
//             <Image
//               src={data.imageUrl}
//               alt="AI生成图片"
//               width={512}
//               height={512}
//               style={{
//                 borderRadius: 12,
//                 marginTop: 10,
//                 maxWidth: "100%",
//                 height: "auto",
//               }}
//             />
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

// ---

// "use client";

// import { useState } from "react";
// import Image from "next/image";

// export default function Page() {
//   const [prompt, setPrompt] = useState("阳光沙滩美女");
//   const [loading, setLoading] = useState(false);
//   const [result, setResult] = useState<any>(null);
//   const [error, setError] = useState("");

//   const handleGenerate = async () => {
//     try {
//       setLoading(true);
//       setError("");
//       setResult(null);

//       const res = await fetch("/api/generate-image", {
//         method: "POST",
//         headers: {
//           "Content-Type": "application/json",
//         },
//         body: JSON.stringify({
//           prompt,
//         }),
//       });

//       const json = await res.json();

//       if (!res.ok || !json.success) {
//         throw new Error(json.error || "生成失败");
//       }

//       setResult(json.data);
//     } catch (e: any) {
//       setError(e.message || "请求失败");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div style={{ padding: 40 }}>
//       <h1 style={{ fontSize: 24, marginBottom: 20 }}>AI 生图测试页面</h1>

//       {/* 输入框 */}
//       <textarea
//         value={prompt}
//         onChange={(e) => setPrompt(e.target.value)}
//         rows={3}
//         style={{
//           width: "100%",
//           padding: 10,
//           fontSize: 16,
//           border: "1px solid #ccc",
//           borderRadius: 8,
//         }}
//       />

//       {/* 按钮 */}
//       <button
//         onClick={handleGenerate}
//         disabled={loading}
//         style={{
//           marginTop: 20,
//           padding: "10px 20px",
//           fontSize: 16,
//           background: "#0070f3",
//           color: "#fff",
//           border: "none",
//           borderRadius: 8,
//           cursor: "pointer",
//         }}
//       >
//         {loading ? "生成中..." : "生成图片"}
//       </button>

//       {result && (
//         <div style={{ marginTop: 20 }}>
//           <pre>{JSON.stringify(result, null, 2)}</pre>

//           {result.imageUrl && (
//             <Image
//               src={result.imageUrl}
//               alt="AI生成图片"
//               width={512}
//               height={512}
//               style={{
//                 borderRadius: 12,
//                 marginTop: 10,
//                 maxWidth: "100%",
//                 height: "auto",
//               }}
//             />
//           )}
//         </div>
//       )}
//     </div>
//   );
// }
