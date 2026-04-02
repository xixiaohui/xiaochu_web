"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { CUISINES, NORMALIZED_CUISINES } from "@/data/cuisines";

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

type ProcessingRecord = {
  rowId: string;
  status: "pending" | "processing" | "success" | "error";
  message: string;
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
  const [streamText, setStreamText] = useState("");
  const [recipe, setRecipe] = useState<RecipeResult | null>(null);
  const [error, setError] = useState("");

  // 批量处理相关状态
  const [autoProcessing, setAutoProcessing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [processingRecords, setProcessingRecords] = useState<ProcessingRecord[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const isProcessingRef = useRef(false);

  const dishRows = useMemo<DishRow[]>(() => {
    return NORMALIZED_CUISINES.flatMap((cuisine) =>
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

  const updateProcessingRecord = (
    rowId: string,
    status: "pending" | "processing" | "success" | "error",
    message: string
  ) => {
    setProcessingRecords((prev) => {
      const existing = prev.find((r) => r.rowId === rowId);
      if (existing) {
        return prev.map((r) =>
          r.rowId === rowId ? { ...r, status, message } : r
        );
      }
      return [...prev, { rowId, status, message }];
    });
  };

  const saveRecipeToDB = async (
    recipeData: RecipeResult,
    dish: DishRow,
    extraReq: string
  ) => {
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
        return "⏭ 已存在相同菜谱，已跳过";
      } else {
        return "✅ 已保存";
      }
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : "保存失败");
    }
  };

  const generateRecipeForDish = async (dish: DishRow): Promise<RecipeResult> => {
    const res = await fetch("/api/recipe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: {
          dishName: dish.dishName,
          ingredients: dish.ingredients,
          cookTime: dish.cookTime,
          difficulty: dish.difficulty,
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
    }

    let parsed: RecipeResult;
    try {
      parsed = JSON.parse(fullText);
    } catch {
      throw new Error("接口返回内容不是合法 JSON");
    }

    return parsed;
  };

  const processNextDish = async (index: number) => {
    if (index >= dishRows.length) {
      setAutoProcessing(false);
      isProcessingRef.current = false;
      return;
    }

    const dish = dishRows[index];
    
    try {
      updateProcessingRecord(dish.rowId, "processing", "生成中...");
      setSelectedRowId(dish.rowId);
      setRecipe(null);
      setStreamText("");

      // 生成菜谱
      const generatedRecipe = await generateRecipeForDish(dish);
      setRecipe(generatedRecipe);

      // 保存到数据库
      updateProcessingRecord(dish.rowId, "processing", "保存中...");
      const saveMsg = await saveRecipeToDB(generatedRecipe, dish, extraRequirements);

      updateProcessingRecord(dish.rowId, "success", saveMsg);
      setProcessedCount((prev) => prev + 1);

      // 延迟后处理下一个菜品
      setTimeout(() => {
        processNextDish(index + 1);
      }, 500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "未知错误";
      updateProcessingRecord(dish.rowId, "error", `❌ ${errorMsg}`);
      
      // 出错后继续处理下一个
      setTimeout(() => {
        processNextDish(index + 1);
      }, 500);
    }
  };

  // 监听 autoProcessing 状态变化，触发批量处理
  useEffect(() => {
    if (autoProcessing && !isProcessingRef.current) {
      isProcessingRef.current = true;
      setCurrentIndex(0);
      setProcessedCount(0);
      setProcessingRecords([]);
      setError("");
      processNextDish(0);
    }
  }, [autoProcessing]);

  const handleStartAutoProcess = () => {
    if (dishRows.length === 0) {
      setError("没有菜品数据");
      return;
    }
    setAutoProcessing(true);
  };

  const handleStopAutoProcess = () => {
    setAutoProcessing(false);
    isProcessingRef.current = false;
  };

  const handleManualSubmit = async () => {
    if (!selectedDish) {
      setError("请先在表格中选择一道菜。");
      return;
    }

    setLoading(true);
    setError("");
    setStreamText("");
    setRecipe(null);

    try {
      const generatedRecipe = await generateRecipeForDish(selectedDish);
      setRecipe(generatedRecipe);

      setSaveLoading(true);
      const saveMsg = await saveRecipeToDB(generatedRecipe, selectedDish, extraRequirements);
      setError(saveMsg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
      setSaveLoading(false);
    }
  };

  const isProcessing = autoProcessing;

  return (
    <main className="page">
      <div className="container">
        <h1 className="title">中餐菜谱生成器</h1>
        <p className="subtitle">
          选择一道菜，调用 Web API 生成菜谱，并自动保存到云数据库
          recipes_web。
        </p>

        <section className="card">
          <h2 className="sectionTitle">批量处理控制</h2>
          <div className="batchControlContainer">
            <div className="batchStats">
              <div className="statItem">
                <span className="statLabel">总菜品数：</span>
                <span className="statValue">{dishRows.length}</span>
              </div>
              <div className="statItem">
                <span className="statLabel">已处理：</span>
                <span className="statValue">{processedCount}</span>
              </div>
              <div className="statItem">
                <span className="statLabel">处理进度：</span>
                <span className="statValue">
                  {dishRows.length > 0
                    ? `${Math.round((processedCount / dishRows.length) * 100)}%`
                    : "0%"}
                </span>
              </div>
            </div>

            <div className="batchButtonGroup">
              <button
                className="batchBtn batchBtnPrimary"
                onClick={handleStartAutoProcess}
                disabled={isProcessing}
              >
                {isProcessing ? "处理中..." : "🚀 开始自动处理全部菜品"}
              </button>
              <button
                className="batchBtn batchBtnDanger"
                onClick={handleStopAutoProcess}
                disabled={!isProcessing}
              >
                🛑 停止处理
              </button>
            </div>

            {isProcessing && (
              <div className="progressBar">
                <div
                  className="progressFill"
                  style={{
                    width: `${
                      dishRows.length > 0
                        ? (processedCount / dishRows.length) * 100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            )}
          </div>
        </section>

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
                  <th style={{ width: 120 }}>处理状态</th>
                </tr>
              </thead>
              <tbody>
                {dishRows.map((row) => {
                  const checked = selectedRowId === row.rowId;
                  const record = processingRecords.find(
                    (r) => r.rowId === row.rowId
                  );

                  return (
                    <tr
                      key={row.rowId}
                      className={`${checked ? "selectedRow" : ""} ${
                        record ? `statusRow status-${record.status}` : ""
                      }`}
                      onClick={() => !isProcessing && setSelectedRowId(row.rowId)}
                    >
                      <td>
                        <input
                          type="radio"
                          name="dish"
                          checked={checked}
                          onChange={() => setSelectedRowId(row.rowId)}
                          disabled={isProcessing}
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
                      <td>
                        <div className="statusBadge">
                          {record ? (
                            <>
                              <span className={`statusIcon status-${record.status}`}>
                                {record.status === "processing" && "⏳"}
                                {record.status === "success" && "✅"}
                                {record.status === "error" && "❌"}
                                {record.status === "pending" && "⏸"}
                              </span>
                              <span className="statusText">{record.message}</span>
                            </>
                          ) : (
                            <span className="statusText">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2 className="sectionTitle">手动提交设置</h2>

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
              disabled={isProcessing}
            />
          </div>

          <button
            className="submitBtn"
            onClick={handleManualSubmit}
            disabled={loading || saveLoading || !selectedDish || isProcessing}
          >
            {loading ? "生成中..." : saveLoading ? "保存中..." : "生成并保存（单个菜品）"}
          </button>

          {error && <div className="errorBox">{error}</div>}
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

        .batchControlContainer {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .batchStats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }

        .statItem {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: #f8fafc;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
        }

        .statLabel {
          font-size: 14px;
          color: #667085;
          font-weight: 500;
        }

        .statValue {
          font-size: 18px;
          font-weight: 700;
          color: #1f2329;
        }

        .batchButtonGroup {
          display: flex;
          gap: 12px;
        }

        .batchBtn {
          flex: 1;
          appearance: none;
          border: none;
          padding: 12px 20px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .batchBtnPrimary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .batchBtnPrimary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }

        .batchBtnPrimary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .batchBtnDanger {
          background: #ff4d4f;
          color: white;
        }

        .batchBtnDanger:hover:not(:disabled) {
          background: #ff7875;
        }

        .batchBtnDanger:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .progressBar {
          width: 100%;
          height: 8px;
          background: #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }

        .progressFill {
          height: 100%;
          background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
          transition: width 0.3s ease;
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
          background: white;
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
          background: #f8fafc;
          cursor: pointer;
        }

        .selectedRow {
          background: #dbeafe !important;
        }

        .statusRow.status-processing {
          background: #fffaed;
        }

        .statusRow.status-success {
          background: #f6ffed;
        }

        .statusRow.status-error {
          background: #fff1f0;
        }

        .cuisineCell {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .statusBadge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
        }

        .statusIcon {
          font-size: 16px;
          display: inline-block;
        }

        .statusText {
          color: #667085;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
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

          .batchButtonGroup {
            flex-direction: column;
          }

          .batchStats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
