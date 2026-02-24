# REMINDER: Choix des modèles LLM pour M3 Max 64GB

La story E1-S6 utilise `llama3.2` par défaut (petit modèle généraliste ~3GB).
Pour de la génération de code, envisager des modèles plus performants :

| Rôle | Modèle recommandé | RAM | Notes |
|------|-------------------|-----|-------|
| Dev (code gen) | `deepseek-coder-v2:16b` ou `qwen2.5-coder:14b` | ~10-12GB | Excellents pour le code |
| Reviewer | `deepseek-coder-v2:16b` ou `qwen2.5-coder:14b` | ~10-12GB | Bon pour l'analyse de code |
| QA / PM | `llama3.1:8b` | ~5GB | Suffisant pour validation |

Total estimé : ~25-30GB sur 64GB disponibles — confortable.

Vérifier les modèles disponibles avec `ollama list` avant de configurer.
Ajuster `cop1.config.yaml` section `llm_routing` en conséquence.
