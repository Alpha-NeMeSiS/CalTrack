import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { CheckCircle, Loader2, RefreshCcw, Sparkles, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DetectedItem, GeneratedRecipe, GoalType, QuantityLevel } from '../../types/fridge';
import { generateRecipesFromItems, analyzeFridgeImage } from '../../utils/fridgeAssistant';

const quantityLabels: Record<QuantityLevel, string> = {
  low: 'Peu',
  medium: 'Moyen',
  high: 'Beaucoup',
};

interface GoalSelectorProps {
  value: GoalType;
  onChange: (goal: GoalType) => void;
}

function GoalSelector({ value, onChange }: GoalSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="font-medium text-sm text-gray-700">Objectif actuel</label>
      <div className="flex gap-2">
        {(
          [
            { id: 'loss', label: 'Perte de poids' },
            { id: 'maintain', label: 'Maintien' },
            { id: 'gain', label: 'Prise de masse' },
          ] as const
        ).map((goal) => (
          <button
            key={goal.id}
            onClick={() => onChange(goal.id)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
              value === goal.id
                ? 'border-shonen-500 bg-shonen-50 text-shonen-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            }`}
          >
            {goal.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface DetectedListProps {
  items: DetectedItem[];
  onToggle: (index: number) => void;
  onNameChange: (index: number, name: string) => void;
  onIdChange: (index: number, id: string) => void;
  onQuantityChange: (index: number, level: QuantityLevel) => void;
}

function DetectedList({ items, onToggle, onNameChange, onIdChange, onQuantityChange }: DetectedListProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
        Aucune détection pour le moment. Uploade une photo puis lance l'analyse.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={`${item.id ?? item.name}-${index}`}
          className={`rounded-xl border p-4 shadow-sm transition ${
            item.enabled ? 'border-shonen-200 bg-white' : 'border-gray-200 bg-gray-50'
          }`}
        >
          <div className="flex items-start gap-4">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 rounded border-gray-300 text-shonen-500 focus:ring-shonen-500"
              checked={item.enabled}
              onChange={() => onToggle(index)}
            />
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-shonen-500 focus:outline-none"
                    value={item.name}
                    onChange={(e) => onNameChange(index, e.target.value)}
                    placeholder="Nom de l'aliment"
                  />
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-shonen-500 focus:outline-none sm:w-52"
                    value={item.id ?? ''}
                    onChange={(e) => onIdChange(index, e.target.value)}
                    placeholder="ID base (ex: OEUF_POULE)"
                  />
                </div>
                <div className="text-xs text-gray-500">Confiance : {(item.confidence * 100).toFixed(0)}%</div>
              </div>
              <div className="flex items-center gap-2">
                {(['low', 'medium', 'high'] as QuantityLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => onQuantityChange(index, level)}
                    className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
                      item.quantityLevel === level
                        ? 'bg-shonen-100 text-shonen-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {quantityLabels[level]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface RecipeListProps {
  recipes: GeneratedRecipe[];
}

function RecipeList({ recipes }: RecipeListProps) {
  if (recipes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
        Les suggestions apparaîtront ici après validation de la liste d'aliments.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {recipes.map((recipe) => (
        <article key={recipe.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-shonen-600">
            <UtensilsCrossed className="h-4 w-4" />
            <span>{recipe.title}</span>
          </div>
          <p className="mb-3 text-sm text-gray-700">{recipe.description}</p>
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Ingrédients à partir de vos stocks
          </div>
          <ul className="mb-3 space-y-1 text-sm text-gray-700">
            {recipe.ingredients.map((ingredient, idx) => (
              <li key={`${recipe.id}-ing-${idx}`} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full bg-shonen-400" aria-hidden />
                <div>
                  <div className="font-medium">{ingredient.name}</div>
                  <div className="text-xs text-gray-500">{ingredient.approxQuantity}</div>
                  {ingredient.foodId && (
                    <div className="text-[11px] text-gray-400">ID base aliments : {ingredient.foodId}</div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
            <span className="rounded-full bg-blue-50 px-2 py-1 font-medium text-blue-700">
              ~{recipe.estimatedPrepMinutes} min
            </span>
            {recipe.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-700">
                {tag}
              </span>
            ))}
            <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
              Calories & macros calculées via la base interne
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function FridgeScanner() {
  const { profile } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingRecipes, setIsGeneratingRecipes] = useState(false);
  const [recipes, setRecipes] = useState<GeneratedRecipe[]>([]);
  const [goalType, setGoalType] = useState<GoalType>('maintain');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Pré-remplit l'objectif si le profil possède un type connu (fallback maintain)
  useEffect(() => {
    if (!profile) return;
    const inferredGoal = (profile as unknown as { goal_type?: GoalType }).goal_type;
    if (inferredGoal) {
      setGoalType(inferredGoal);
    }
  }, [profile]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const enabledItemsCount = useMemo(() => detectedItems.filter((item) => item.enabled).length, [detectedItems]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file ?? null);
    setDetectedItems([]);
    setRecipes([]);
    setErrorMessage(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const results = await analyzeFridgeImage(selectedFile);
      setDetectedItems(results);
    } catch (error) {
      console.error(error);
      setErrorMessage("Impossible d'analyser l'image pour le moment. Merci de réessayer.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateRecipes = async () => {
    if (enabledItemsCount === 0) {
      setErrorMessage('Sélectionne au moins un aliment détecté.');
      return;
    }
    setIsGeneratingRecipes(true);
    setErrorMessage(null);
    try {
      const ideas = await generateRecipesFromItems(detectedItems, goalType);
      setRecipes(ideas);
    } catch (error) {
      console.error(error);
      setErrorMessage('Impossible de générer des idées pour le moment.');
    } finally {
      setIsGeneratingRecipes(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900">Cuisiner avec mon frigo</h1>
        <p className="text-sm text-gray-600">
          Photographiez l'intérieur du frigo, corrigez les aliments détectés et obtenez des idées healthy
          adaptées à votre objectif. Les calories & macros seront calculées à partir de la base interne.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium text-gray-700">Photo de l'intérieur du frigo</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="block w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 shadow-sm focus:border-shonen-500 focus:outline-none"
              />
              <p className="text-xs text-gray-500">Formats images acceptés. L'analyse se fait côté serveur (placeholder).</p>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!selectedFile || isAnalyzing}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-shonen-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-shonen-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isAnalyzing ? 'Analyse en cours...' : 'Analyser mon frigo'}
            </button>
          </div>

          {previewUrl && (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
              <img src={previewUrl} alt="Aperçu du frigo" className="h-64 w-full object-cover" />
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Aliments détectés</h2>
              <div className="text-sm text-gray-500">{enabledItemsCount} sélectionné(s)</div>
            </div>
            <DetectedList
              items={detectedItems}
              onToggle={(index) =>
                setDetectedItems((prev) => prev.map((item, i) => (i === index ? { ...item, enabled: !item.enabled } : item)))
              }
              onNameChange={(index, name) =>
                setDetectedItems((prev) => prev.map((item, i) => (i === index ? { ...item, name } : item)))
              }
              onIdChange={(index, id) =>
                setDetectedItems((prev) => prev.map((item, i) => (i === index ? { ...item, id: id || undefined } : item)))
              }
              onQuantityChange={(index, level) =>
                setDetectedItems((prev) => prev.map((item, i) => (i === index ? { ...item, quantityLevel: level } : item)))
              }
            />
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <GoalSelector value={goalType} onChange={setGoalType} />
            <button
              onClick={handleGenerateRecipes}
              disabled={isGeneratingRecipes || isAnalyzing || detectedItems.length === 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isGeneratingRecipes ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              {isGeneratingRecipes ? 'Génération en cours...' : 'Valider la liste'}
            </button>
            <p className="mt-3 text-xs text-gray-500">
              Les macros seront calculées à partir de vos aliments enregistrés. Les sorties IA servent de suggestion
              et ne sont pas des données médicales.
            </p>
            {errorMessage && <p className="mt-3 text-sm text-red-600">{errorMessage}</p>}
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <RefreshCcw className="h-4 w-4" />
              <span>Conseil</span>
            </div>
            Vous pouvez corriger les noms/IDs pour coller à la base d'aliments (CIQUAL) avant de lancer la génération.
          </div>
        </aside>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-shonen-600" />
          <h2 className="text-lg font-semibold text-gray-900">Idées de plats healthy</h2>
        </div>
        <RecipeList recipes={recipes} />
      </section>
    </div>
  );
}
