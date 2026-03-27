"use client";

import { useMemo, useState } from "react";
import { CUISINES } from "@/data/cuisines";

type Difficulty = "easy" | "medium" | "hard" | "简单" | "中等" | "困难";

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

type DishRow = {
  rowId: string;
  cuisineId: string;
  cuisineName: string;
  cuisineEmoji: string;
  cuisineDesc: string;
  dishName: string;
  dishDesc: string;
  cookTime: number;
  difficulty: Difficulty;
  ingredients: string[];
};

const difficultyTextMap: Record<string, string> = {
  easy: "简单",
  medium: "中等",
  hard: "困难",
  简单: "简单",
  中等: "中等",
  困难: "困难",
};

export default function Page() {
  const [selectedRowId, setSelectedRowId] = useState<string>("");
  const [extraRequirements, setExtraRequirements] = useState("");
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [streamText, setStreamText] = useState("");
  const [recipe, setRecipe] = useState<RecipeResult | null>(null);
  const [error, setError] = useState("");

  const dishRows = useMemo<DishRow[]>(() => {
    return CUISINES.flatMap((cuisine) =>
      cuisine.representativeDishes.map((dish, index) => ({
        rowId: `${cuisine.id}-${index}`,
        cuisineId: cuisine.id,
        cuisineName: cuisine.name,
        cuisineEmoji: cuisine.emoji,
        cuisineDesc: cuisine.description,
        dishName: dish.name,
        dishDesc: dish.desc,
        cookTime: dish.cookTime,
        difficulty: dish.difficulty as Difficulty,
        ingredients: dish.ingredients,
      }))
    );
  }, []);

  const selectedDish = dishRows.find((item) => item.rowId === selectedRowId);

  const saveRecipeToDB = async (
    recipeData: RecipeResult,
    dish: DishRow,
    extraReq: string
  ) => {
    setSaveLoading(true);
    setSaveStatus("");

    try {
      const res = await fetch("/api/recipes-web/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipe: recipeData,
          source: {
            cuisineId: dish.cuisineId,
            cuisineName: dish.cuisineName,
            cuisineEmoji: dish.cuisineEmoji,
            dishName: dish.dishName,
            dishDesc: dish.dishDesc,
            ingredients: dish.ingredients,
            cookTime: dish.cookTime,
            difficulty: dish.difficulty,
            extraRequirements: extraReq,
          },
        }),
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.message || "保存失败");
      }

      if (result.skipped) {
        setSaveStatus("⏭ 已存在相同菜谱，已跳过保存");
      } else {
        setSaveStatus("✅ 已成功保存到 recipes_web");
      }
    } catch (err) {
      setSaveStatus(
        `❌ 保存失败：${err instanceof Error ? err.message : "未知错误"}`
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDish) {
      setError("请先在表格中选择一道菜。");
      return;
    }

    setLoading(true);
    setError("");
    setStreamText("");
    setRecipe(null);
    setSaveStatus("");

    try {
      const res = await fetch("/api/recipe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            ingredients: selectedDish.ingredients,
            cookTime: selectedDish.cookTime,
            difficulty: selectedDish.difficulty,
            extraRequirements,
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`请求失败：${res.status}`);
      }

      if (!res.body) {
        throw new Error("接口没有返回可读取的数据流");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreamText(fullText);
      }

      let parsed: RecipeResult;
      try {
        parsed = JSON.parse(fullText);
      } catch {
        throw new Error("接口已返回内容，但不是合法 JSON，请检查模型输出");
      }

      setRecipe(parsed);

      // 自动保存到云数据库 recipes_web
      await saveRecipeToDB(parsed, selectedDish, extraRequirements);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page">
      <div className="container">
        <h1 className="title">中餐菜谱生成器</h1>
        <p className="subtitle">
          选择一道菜，调用 Web API 生成菜谱，并自动保存到云数据库
          recipes_web。
        </p>

        <section className="card">
          <h2 className="sectionTitle">菜品列表</h2>

          <div className="tableWrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>选择</th>
                  <th>菜系</th>
                  <th>菜名</th>
                  <th>描述</th>
                  <th>食材</th>
                  <th style={{ width: 100 }}>时间</th>
                  <th style={{ width: 100 }}>难度</th>
                </tr>
              </thead>
              <tbody>
                {dishRows.map((row) => {
                  const checked = selectedRowId === row.rowId;

                  return (
                    <tr
                      key={row.rowId}
                      className={checked ? "selectedRow" : ""}
                      onClick={() => setSelectedRowId(row.rowId)}
                    >
                      <td>
                        <input
                          type="radio"
                          name="dish"
                          checked={checked}
                          onChange={() => setSelectedRowId(row.rowId)}
                        />
                      </td>
                      <td>
                        <div className="cuisineCell">
                          <span>{row.cuisineEmoji}</span>
                          <span>{row.cuisineName}</span>
                        </div>
                      </td>
                      <td>{row.dishName}</td>
                      <td>{row.dishDesc}</td>
                      <td>{row.ingredients.join("、")}</td>
                      <td>{row.cookTime} 分钟</td>
                      <td>{difficultyTextMap[row.difficulty] || row.difficulty}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2 className="sectionTitle">提交设置</h2>

          {selectedDish ? (
            <div className="selectedInfo">
              <div>
                <strong>已选菜品：</strong>
                {selectedDish.cuisineEmoji} {selectedDish.cuisineName} /{" "}
                {selectedDish.dishName}
              </div>
              <div>
                <strong>食材：</strong>
                {selectedDish.ingredients.join("、")}
              </div>
              <div>
                <strong>时间：</strong>
                {selectedDish.cookTime} 分钟
              </div>
              <div>
                <strong>难度：</strong>
                {difficultyTextMap[selectedDish.difficulty] ||
                  selectedDish.difficulty}
              </div>
            </div>
          ) : (
            <div className="emptyTip">请先从上面的表格中选择一道菜。</div>
          )}

          <div className="formItem">
            <label htmlFor="extraRequirements">附加要求</label>
            <textarea
              id="extraRequirements"
              value={extraRequirements}
              onChange={(e) => setExtraRequirements(e.target.value)}
              placeholder="例如：少油、不要太辣、适合两个人吃"
              rows={4}
            />
          </div>

          <button
            className="submitBtn"
            onClick={handleSubmit}
            disabled={loading || saveLoading || !selectedDish}
          >
            {loading ? "生成中..." : saveLoading ? "保存中..." : "生成并保存到 recipes_web"}
          </button>

          {error && <div className="errorBox">{error}</div>}
          {saveStatus && <div className="saveBox">{saveStatus}</div>}
        </section>

        <section className="card">
          <h2 className="sectionTitle">接口返回</h2>

          <div className="resultGrid">
            <div>
              <h3 className="subTitle">流式原始返回</h3>
              <pre className="streamBox">
                {streamText || "这里会显示接口返回的原始 JSON 文本"}
              </pre>
            </div>

            <div>
              <h3 className="subTitle">解析后的食谱结果</h3>

              {!recipe ? (
                <div className="emptyTip">提交后，这里会展示解析后的 JSON 数据。</div>
              ) : (
                <div className="recipeBox">
                  <div className="recipeHeader">
                    <h3>{recipe.name}</h3>
                    <p>{recipe.description}</p>
                  </div>

                  <div className="metaGrid">
                    <div>烹饪时间：{recipe.cookTime} 分钟</div>
                    <div>难度：{recipe.difficulty}</div>
                    <div>份量：{recipe.servings} 人</div>
                    <div>标签：{recipe.tags?.join("、") || "-"}</div>
                  </div>

                  <h4>食材</h4>
                  <table className="table smallTable">
                    <thead>
                      <tr>
                        <th>食材名</th>
                        <th>用量</th>
                        <th>单位</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipe.ingredients?.map((item, index) => (
                        <tr key={index}>
                          <td>{item.name}</td>
                          <td>{item.amount}</td>
                          <td>{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h4>步骤</h4>
                  <table className="table smallTable">
                    <thead>
                      <tr>
                        <th style={{ width: 80 }}>步骤</th>
                        <th>说明</th>
                        <th>小贴士</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipe.steps?.map((step) => (
                        <tr key={step.step}>
                          <td>{step.step}</td>
                          <td>{step.description}</td>
                          <td>{step.tip || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h4>营养信息</h4>
                  <table className="table smallTable">
                    <thead>
                      <tr>
                        <th>热量</th>
                        <th>蛋白质</th>
                        <th>碳水</th>
                        <th>脂肪</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>{recipe.nutrition?.calories ?? "-"} kcal</td>
                        <td>{recipe.nutrition?.protein ?? "-"} g</td>
                        <td>{recipe.nutrition?.carbs ?? "-"} g</td>
                        <td>{recipe.nutrition?.fat ?? "-"} g</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: #f7f8fa;
          padding: 32px 20px 60px;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .title {
          margin: 0 0 8px;
          font-size: 32px;
          font-weight: 700;
          color: #1f2329;
        }

        .subtitle {
          margin: 0 0 24px;
          color: #4e5969;
          font-size: 15px;
        }

        .card {
          background: #fff;
          border-radius: 16px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 6px 24px rgba(15, 23, 42, 0.06);
        }

        .sectionTitle {
          margin: 0 0 16px;
          font-size: 20px;
          color: #1f2329;
        }

        .subTitle {
          margin: 0 0 12px;
          font-size: 16px;
          color: #1f2329;
        }

        .tableWrap {
          overflow: auto;
          border: 1px solid #e5e6eb;
          border-radius: 12px;
        }

        .table {
          width: 100%;
          border-collapse: collapse;
          background: #1c0344;
        }

        .table th,
        .table td {
          border-bottom: 1px solid #f0f0f0;
          padding: 12px;
          text-align: left;
          vertical-align: top;
          font-size: 14px;
        }

        .table th {
          background: #fafafa;
          color: #1f2329;
          font-weight: 600;
          white-space: nowrap;
        }

        .table tbody tr:hover {
          background: #0066ff;
          cursor: pointer;
        }

        .selectedRow {
          background: #edf5ff !important;
        }

        .cuisineCell {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .selectedInfo {
          display: grid;
          gap: 8px;
          padding: 14px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          margin-bottom: 16px;
        }

        .formItem {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }

        .formItem label {
          font-size: 14px;
          font-weight: 600;
          color: #1f2329;
        }

        .formItem textarea {
          width: 100%;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          padding: 12px;
          font-size: 14px;
          resize: vertical;
          outline: none;
        }

        .formItem textarea:focus {
          border-color: #1677ff;
          box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.1);
        }

        .submitBtn {
          appearance: none;
          border: none;
          background: #1677ff;
          color: white;
          padding: 12px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .submitBtn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .errorBox {
          margin-top: 14px;
          background: #fff1f0;
          color: #cf1322;
          border: 1px solid #ffa39e;
          padding: 12px;
          border-radius: 10px;
        }

        .saveBox {
          margin-top: 14px;
          background: #f6ffed;
          color: #389e0d;
          border: 1px solid #b7eb8f;
          padding: 12px;
          border-radius: 10px;
        }

        .emptyTip {
          color: #667085;
          background: #f8fafc;
          border: 1px dashed #d0d5dd;
          padding: 14px;
          border-radius: 10px;
        }

        .resultGrid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .streamBox {
          margin: 0;
          min-height: 360px;
          max-height: 700px;
          overflow: auto;
          background: #0f172a;
          color: #e2e8f0;
          padding: 16px;
          border-radius: 12px;
          font-size: 13px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .recipeBox {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .recipeHeader h3 {
          margin: 0 0 6px;
          font-size: 24px;
        }

        .recipeHeader p {
          margin: 0;
          color: #4e5969;
        }

        .metaGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          background: #f8fafc;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
        }

        .smallTable th,
        .smallTable td {
          padding: 10px;
        }

        @media (max-width: 1024px) {
          .resultGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
