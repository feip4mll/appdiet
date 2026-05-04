import "dart:convert";
import "dart:io";
import "dart:math";

import "package:crypto/crypto.dart";
import "package:flutter/foundation.dart";
import "package:flutter/material.dart";
import "package:google_fonts/google_fonts.dart";
import "package:http/http.dart" as http;
import "package:image_picker/image_picker.dart";
import "package:path/path.dart" as p;
import "package:shared_preferences/shared_preferences.dart";
import "package:sqflite/sqflite.dart";
import "package:sqflite_common_ffi_web/sqflite_ffi_web.dart";

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AppDatabase.instance.init();
  runApp(const PrimeDietApp());
}

class PrimeDietApp extends StatefulWidget {
  const PrimeDietApp({super.key});

  @override
  State<PrimeDietApp> createState() => _PrimeDietAppState();
}

class _PrimeDietAppState extends State<PrimeDietApp> {
  int? _userId;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final userId = await SessionStore.getUserId();
    if (!mounted) return;
    setState(() {
      _userId = userId;
      _loading = false;
    });
  }

  Future<void> _onAuthenticated(int userId) async {
    await SessionStore.setUserId(userId);
    if (!mounted) return;
    setState(() => _userId = userId);
  }

  Future<void> _onLogout() async {
    await SessionStore.clearSession();
    if (!mounted) return;
    setState(() => _userId = null);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: "Prime Diet",
      theme: ThemeData(
        useMaterial3: true,
        textTheme: GoogleFonts.poppinsTextTheme(ThemeData.dark().textTheme),
        scaffoldBackgroundColor: const Color(0xFF070D1E),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6EE7A3),
          brightness: Brightness.dark,
          background: const Color(0xFF070D1E),
        ),
      ),
      home: _loading
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : (_userId == null
                ? AuthScreen(onAuthenticated: _onAuthenticated)
                : HomeScreen(userId: _userId!, onLogout: _onLogout)),
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.onAuthenticated});

  final Future<void> Function(int userId) onAuthenticated;

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isLogin = true;
  String _feedback = "";
  bool _busy = false;

  String get _authTitle {
    final hour = DateTime.now().hour;
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _busy = true);
    final db = AppDatabase.instance;
    final email = _emailController.text.trim().toLowerCase();
    final password = _passwordController.text.trim();
    final name = _nameController.text.trim();

    if (email.isEmpty || password.length < 4 || (!_isLogin && name.isEmpty)) {
      setState(() {
        _feedback = "Preencha os campos corretamente.";
        _busy = false;
      });
      return;
    }

    if (_isLogin) {
      final userId = await db.login(email, password);
      if (userId == null) {
        setState(() {
          _feedback = "Credenciais invalidas.";
          _busy = false;
        });
        return;
      }
      await widget.onAuthenticated(userId);
    } else {
      final ok = await db.register(name, email, password);
      setState(() {
        _feedback = ok ? "Conta criada com sucesso." : "Email ja cadastrado.";
        if (ok) _isLogin = true;
        _busy = false;
      });
      return;
    }

    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF07142E), Color(0xFF070D1E), Color(0xFF0E1221)],
          ),
        ),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Container(
              margin: const EdgeInsets.all(16),
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFF10221A).withOpacity(0.35),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: Colors.white.withOpacity(0.16)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    "PRIMEDIET",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 44,
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w700,
                      color: Color(0xFF79D89E),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    "$_authTitle! Bora construir seu melhor dia.",
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.72),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 14),
                  SegmentedButton<bool>(
                    style: ButtonStyle(
                      backgroundColor: WidgetStatePropertyAll(
                        Colors.white.withOpacity(0.02),
                      ),
                    ),
                    segments: const [
                      ButtonSegment(value: true, label: Text("Login")),
                      ButtonSegment(value: false, label: Text("Cadastro")),
                    ],
                    selected: {_isLogin},
                    onSelectionChanged: (values) {
                      setState(() {
                        _isLogin = values.first;
                        _feedback = "";
                      });
                    },
                  ),
                  const SizedBox(height: 16),
                  if (!_isLogin) ...[
                    _DarkField(
                      controller: _nameController,
                      label: "Como voce quer ser chamado",
                      icon: Icons.person_outline,
                    ),
                    const SizedBox(height: 10),
                  ],
                  _DarkField(
                    controller: _emailController,
                    label: "Seu melhor e-mail",
                    icon: Icons.alternate_email,
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 10),
                  _DarkField(
                    controller: _passwordController,
                    label: "Senha de acesso",
                    icon: Icons.lock_outline,
                    obscureText: true,
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        foregroundColor: const Color(0xFF0A2320),
                        backgroundColor: const Color(0xFF7FDBA6),
                      ),
                      onPressed: _busy ? null : _submit,
                      child: Text(_isLogin ? "Entrar" : "Criar conta"),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    _feedback,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white.withOpacity(0.75)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.userId, required this.onLogout});

  final int userId;
  final Future<void> Function() onLogout;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final _random = Random();
  final _aiReplyController = TextEditingController();
  List<Meal> _meals = [];
  DateTime _selectedDate = _dateOnly(DateTime.now());
  int _waterMl = 1500;
  int _dailyGoal = 2000;
  String _aiFeedback = "";
  String _aiStatus = "";
  bool _aiBusy = false;
  bool _loading = true;

  String _heroLine() {
    final hour = DateTime.now().hour;
    if (hour < 12) return "Ritmo forte para comecar o dia.";
    if (hour < 18) return "Consistencia no meio do dia.";
    return "Fechamento inteligente da rotina.";
  }

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final db = AppDatabase.instance;
    final meals = await db.getMealsByDate(widget.userId, _selectedDate);
    final water = await SessionStore.getWaterMl(widget.userId, _selectedDate);
    final goal = await SessionStore.getCaloriesGoal(widget.userId);
    if (!mounted) return;
    setState(() {
      _meals = meals;
      _waterMl = water;
      _dailyGoal = goal;
      _loading = false;
    });
  }

  Future<void> _pickDate() async {
    final now = _dateOnly(DateTime.now());
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate.isAfter(now) ? now : _selectedDate,
      firstDate: DateTime(now.year - 2, 1, 1),
      lastDate: now,
      helpText: "Selecionar dia",
    );
    if (picked == null) return;
    setState(() => _selectedDate = _dateOnly(picked));
    await _refresh();
  }

  Future<void> _addWater(int amount) async {
    final next = _waterMl + amount;
    await SessionStore.setWaterMl(widget.userId, _selectedDate, next);
    if (!mounted) return;
    setState(() => _waterMl = next);
  }

  Future<void> _setWaterValue() async {
    final controller = TextEditingController(text: _waterMl.toString());
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => _NumberDialog(
        title: "Definir agua (ml)",
        controller: controller,
        actionText: "Salvar",
      ),
    );
    if (ok != true) return;
    final parsed = int.tryParse(controller.text.trim());
    if (parsed == null || parsed <= 0) return;
    await SessionStore.setWaterMl(widget.userId, _selectedDate, parsed);
    if (!mounted) return;
    setState(() => _waterMl = parsed);
  }

  Future<void> _setCalorieGoal() async {
    final controller = TextEditingController(text: _dailyGoal.toString());
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => _NumberDialog(
        title: "Definir meta calorica",
        controller: controller,
        actionText: "Salvar",
      ),
    );
    if (ok != true) return;
    final parsed = int.tryParse(controller.text.trim());
    if (parsed == null || parsed < 1000 || parsed > 7000) return;
    await SessionStore.setCaloriesGoal(widget.userId, parsed);
    if (!mounted) return;
    setState(() => _dailyGoal = parsed);
  }

  Future<void> _deleteMeal(Meal meal) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Excluir refeicao"),
        content: const Text("Deseja realmente excluir esta refeicao?"),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text("Cancelar"),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text("Excluir"),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    await AppDatabase.instance.deleteMeal(widget.userId, meal.id!);
    await _refresh();
  }

  Future<void> _openMealForm({Meal? meal}) async {
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => MealFormScreen(
          userId: widget.userId,
          meal: meal,
          selectedDate: _selectedDate,
        ),
      ),
    );
    if (changed == true) await _refresh();
  }

  String _generateFeedback() {
    final totalCalories = _meals.fold<int>(0, (sum, meal) => sum + meal.calories);
    final mealCount = _meals.length;
    final intro = [
      "Leitura rapida de hoje:",
      "Raio-x do seu dia ate agora:",
      "Resumo inteligente do dia:",
    ][_random.nextInt(3)];

    final positive = <String>[];
    final improve = <String>[];

    if (mealCount >= 3) {
      positive.add("Bom ritmo: voce registrou varias refeicoes no dia.");
    } else {
      improve.add("Ainda faltam refeicoes para fechar melhor seu acompanhamento.");
    }

    if (totalCalories >= (_dailyGoal * 0.75).round() && totalCalories <= (_dailyGoal * 1.1).round()) {
      positive.add("Consumo calorico esta em uma faixa boa para a sua meta.");
    } else if (totalCalories < (_dailyGoal * 0.6).round()) {
      improve.add("Calorias ficaram baixas para a meta definida.");
    } else {
      improve.add("Calorias ficaram acima da meta planejada.");
    }

    if (_waterMl >= 1800) {
      positive.add("Hidratacao esta bem encaminhada.");
    } else {
      improve.add("Aumentar agua pode melhorar energia e recuperacao.");
    }

    final nextStep = [
      "Proximo passo: foque em constancia nas proximas refeicoes.",
      "Proximo passo: ajuste porcoes e mantenha hidratacao regular.",
      "Proximo passo: registre tudo ate o fim do dia para analise completa.",
    ][_random.nextInt(3)];

    final posText = positive.isEmpty ? "Voce ja iniciou bem registrando seu dia." : positive.join(" ");
    final impText = improve.isEmpty ? "Sem alertas fortes por agora." : improve.join(" ");
    return "$intro\n\n1) Pontos positivos\n$posText\n\n2) Pontos para melhorar\n$impText\n\n3) Proximo passo pratico\n$nextStep";
  }

  Future<void> _generateFeedbackFromAi() async {
    if (_aiBusy) return;

    setState(() {
      _aiBusy = true;
      _aiStatus = "Gerando feedback personalizado...";
    });

    final totalCalories = _meals.fold<int>(0, (sum, meal) => sum + meal.calories);
    final mealsText = _meals.isEmpty
        ? "Nenhuma refeicao registrada."
        : _meals
              .map((m) => "- ${m.mealType}: ${m.name} (${m.calories} kcal)")
              .join("\n");

    final prompt = """
Data selecionada: ${dayLabelPt(_selectedDate)}
Meta diaria: $_dailyGoal kcal
Calorias consumidas: $totalCalories kcal
Agua: ${_waterMl} ml
Refeicoes:
$mealsText

Crie um feedback em portugues-BR, objetivo, humano e motivador.
Formato:
1) Pontos positivos
2) Pontos para melhorar
3) Proximo passo pratico para hoje

Evite linguagem generica e adapte ao contexto acima.
""";

    try {
      final response = await http.post(
        Uri.parse("${_apiBaseUrl()}/api/ai/meal-feedback"),
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonEncode({
          "prompt": prompt,
          "userId": widget.userId,
          "date": _selectedDate.toIso8601String(),
          "goalCalories": _dailyGoal,
          "waterMl": _waterMl,
          "userMessage": "",
          "currentFeedback": _aiFeedback,
          "meals":
              _meals
                  .map(
                    (m) => {
                      "name": m.name,
                      "calories": m.calories,
                      "type": m.mealType,
                    },
                  )
                  .toList(),
        }),
      );

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final apiError = (data["error"] ?? response.body).toString();
        throw Exception("Falha API (${response.statusCode}): $apiError");
      }

      final text = (data["feedback"] ?? data["message"] ?? "").toString();
      if (text.trim().isEmpty) {
        throw Exception("Resposta vazia da IA.");
      }

      if (!mounted) return;
      setState(() {
        _aiFeedback = text.trim();
        _aiStatus = "Feedback atualizado com sucesso.";
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _aiFeedback = "");
      debugPrint("Erro ao gerar feedback IA: $error");
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "Nao foi possivel gerar feedback da IA agora. Tente novamente em instantes.",
          ),
        ),
      );
      setState(() => _aiStatus = "IA indisponivel no momento.");
    } finally {
      if (mounted) setState(() => _aiBusy = false);
    }
  }

  Future<void> _sendReplyToAi() async {
    if (_aiBusy) return;
    final userMessage = _aiReplyController.text.trim();
    if (userMessage.isEmpty) return;

    setState(() {
      _aiBusy = true;
      _aiStatus = "Enviando sua resposta para a IA...";
    });
    try {
      final response = await http.post(
        Uri.parse("${_apiBaseUrl()}/api/ai/meal-feedback"),
        headers: {
          "Content-Type": "application/json",
        },
        body: jsonEncode({
          "userId": widget.userId,
          "date": _selectedDate.toIso8601String(),
          "goalCalories": _dailyGoal,
          "waterMl": _waterMl,
          "userMessage": userMessage,
          "currentFeedback": _aiFeedback,
          "meals":
              _meals
                  .map(
                    (m) => {
                      "name": m.name,
                      "calories": m.calories,
                      "type": m.mealType,
                    },
                  )
                  .toList(),
        }),
      );

      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode < 200 || response.statusCode >= 300) {
        final apiError = (data["error"] ?? response.body).toString();
        throw Exception("Falha API (${response.statusCode}): $apiError");
      }
      final text = (data["feedback"] ?? data["message"] ?? "").toString();
      if (text.trim().isEmpty) {
        throw Exception("Resposta vazia da IA.");
      }
      if (!mounted) return;
      setState(() {
        _aiFeedback = text.trim();
        _aiReplyController.clear();
        _aiStatus = "Resposta aplicada ao feedback.";
      });
    } catch (error) {
      if (!mounted) return;
      debugPrint("Erro ao enviar resposta para IA: $error");
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            "Nao conseguimos processar sua resposta agora. Tente novamente.",
          ),
        ),
      );
      setState(() => _aiStatus = "Falha ao processar resposta.");
    } finally {
      if (mounted) setState(() => _aiBusy = false);
    }
  }

  String _apiBaseUrl() {
    if (kIsWeb) return "http://localhost:8080";
    if (Platform.isAndroid) return "http://10.0.2.2:8080";
    return "http://localhost:8080";
  }

  void _onClearFeedback() {
    setState(() {
      _aiFeedback = "";
      _aiReplyController.clear();
      _aiStatus = "Feedback limpo.";
    });
  }

  @override
  void dispose() {
    _aiReplyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final totalCalories = _meals.fold<int>(0, (sum, meal) => sum + meal.calories);
    final caloriesProgress = (totalCalories / _dailyGoal).clamp(0, 1).toDouble();
    final isToday = DateUtils.isSameDay(_selectedDate, DateTime.now());
    final subtitle = isToday ? "Resumo de Hoje" : "Resumo de ${formatDatePt(_selectedDate)}";

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF06132D), Color(0xFF070D1E), Color(0xFF121827)],
          ),
        ),
        child: SafeArea(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _Glass(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    subtitle,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      fontSize: 34,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF77DFA0),
                                      height: 1.1,
                                    ),
                                  ),
                                ),
                                OutlinedButton(
                                  onPressed: widget.onLogout,
                                  child: const Text("Sair"),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _heroLine(),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white.withOpacity(0.7),
                                fontSize: 14,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  dayLabelPt(_selectedDate),
                                  style: TextStyle(color: Colors.white.withOpacity(0.72)),
                                ),
                                const SizedBox(width: 10),
                                TextButton.icon(
                                  onPressed: _pickDate,
                                  icon: const Icon(Icons.calendar_month_outlined),
                                  label: const Text("Calendario"),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 14),
                      _Glass(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                const Expanded(
                                  child: Text(
                                    "Calorias",
                                    style: TextStyle(
                                      color: Color(0xFFB3C6BC),
                                      fontSize: 17,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                TextButton(
                                  onPressed: _setCalorieGoal,
                                  child: const Text("Ajustar meta"),
                                ),
                              ],
                            ),
                            Text(
                              "$totalCalories / $_dailyGoal kcal",
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 26,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 10),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(99),
                              child: LinearProgressIndicator(
                                minHeight: 10,
                                value: caloriesProgress,
                                backgroundColor: Colors.white.withOpacity(0.08),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      _Glass(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                const Expanded(
                                  child: Text(
                                    "Agua",
                                    style: TextStyle(
                                      color: Color(0xFFB3C6BC),
                                      fontSize: 17,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                TextButton(
                                  onPressed: _setWaterValue,
                                  child: const Text("Editar hidratacao"),
                                ),
                              ],
                            ),
                            Text(
                              "${(_waterMl / 1000).toStringAsFixed(2)} L",
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 10),
                            Wrap(
                              alignment: WrapAlignment.center,
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                _quickBtn("+250", () => _addWater(250)),
                                _quickBtn("+500", () => _addWater(500)),
                                _quickBtn("+750", () => _addWater(750)),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      _Glass(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              "Refeicoes do dia",
                              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 10),
                            if (_meals.isEmpty)
                              Text(
                                "Nenhuma refeicao registrada nesse dia.",
                                style: TextStyle(color: Colors.white.withOpacity(0.72)),
                              ),
                            ..._meals.map((meal) => _MealTile(
                                  meal: meal,
                                  onEdit: () => _openMealForm(meal: meal),
                                  onDelete: () => _deleteMeal(meal),
                                )),
                            const SizedBox(height: 8),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton.icon(
                                onPressed: () => _openMealForm(),
                                icon: const Icon(Icons.add),
                                label: const Text("Adicionar nova refeicao"),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      _Glass(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                const Expanded(
                                  child: Text(
                                    "Feedback IA",
                                    style: TextStyle(
                                      color: Color(0xFF7ADCA3),
                                      fontSize: 30,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                                OutlinedButton(
                                  onPressed: _aiBusy ? null : _generateFeedbackFromAi,
                                  child: Text(_aiBusy ? "Gerando..." : "Gerar"),
                                ),
                                const SizedBox(width: 8),
                                OutlinedButton(
                                  onPressed: _aiFeedback.isEmpty ? null : _onClearFeedback,
                                  child: const Text("Limpar"),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            if (_aiBusy)
                              ClipRRect(
                                borderRadius: BorderRadius.circular(999),
                                child: LinearProgressIndicator(
                                  minHeight: 6,
                                  backgroundColor: Colors.white.withOpacity(0.08),
                                ),
                              ),
                            if (_aiBusy) const SizedBox(height: 10),
                            Text(
                              _aiFeedback.isEmpty
                                  ? "Clique em Gerar para receber uma leitura personalizada do seu dia."
                                  : _aiFeedback,
                              style: TextStyle(color: Colors.white.withOpacity(0.9), height: 1.34),
                            ),
                            if (_aiStatus.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text(
                                _aiStatus,
                                style: TextStyle(
                                  color: Colors.white.withOpacity(0.65),
                                  fontSize: 12,
                                ),
                              ),
                            ],
                            const SizedBox(height: 12),
                            TextField(
                              controller: _aiReplyController,
                              minLines: 1,
                              maxLines: 3,
                              decoration: _fieldDecoration(
                                "Responder a IA (ex.: quero foco em ganho de massa)",
                                icon: Icons.reply_all_outlined,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Align(
                              alignment: Alignment.centerRight,
                              child: FilledButton.icon(
                                onPressed: _aiBusy ? null : _sendReplyToAi,
                                icon: const Icon(Icons.send),
                                label: Text(_aiBusy ? "Enviando..." : "Enviar resposta"),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
        ),
      ),
    );
  }

  Widget _quickBtn(String label, VoidCallback onTap) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: Colors.white.withOpacity(0.3)),
      ),
      child: Text(label),
    );
  }
}

class MealFormScreen extends StatefulWidget {
  const MealFormScreen({
    super.key,
    required this.userId,
    required this.selectedDate,
    this.meal,
  });

  final int userId;
  final DateTime selectedDate;
  final Meal? meal;

  @override
  State<MealFormScreen> createState() => _MealFormScreenState();
}

class _MealFormScreenState extends State<MealFormScreen> {
  final _nameController = TextEditingController();
  final _caloriesController = TextEditingController();
  String _mealType = "Cafe da manha";
  String? _photoPath;
  bool _busy = false;

  bool get _isEditing => widget.meal != null;

  @override
  void initState() {
    super.initState();
    final meal = widget.meal;
    if (meal != null) {
      _nameController.text = meal.name;
      _caloriesController.text = meal.calories.toString();
      _mealType = meal.mealType;
      _photoPath = meal.photoPath;
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _caloriesController.dispose();
    super.dispose();
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery, imageQuality: 75);
    if (!mounted || file == null) return;
    setState(() => _photoPath = file.path);
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    final calories = int.tryParse(_caloriesController.text.trim()) ?? 0;
    if (name.isEmpty || calories <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Preencha nome e calorias corretamente.")),
      );
      return;
    }

    setState(() => _busy = true);
    final db = AppDatabase.instance;
    if (_isEditing) {
      await db.updateMeal(
        widget.userId,
        Meal(
          id: widget.meal!.id,
          userId: widget.userId,
          name: name,
          calories: calories,
          mealType: _mealType,
          photoPath: _photoPath,
          createdAt: widget.meal!.createdAt,
        ),
      );
    } else {
      final date = _dateOnly(widget.selectedDate);
      final createdAt = DateTime(
        date.year,
        date.month,
        date.day,
        DateTime.now().hour,
        DateTime.now().minute,
        DateTime.now().second,
      );
      await db.insertMeal(
        Meal(
          userId: widget.userId,
          name: name,
          calories: calories,
          mealType: _mealType,
          photoPath: _photoPath,
          createdAt: createdAt.toIso8601String(),
        ),
      );
    }
    if (!mounted) return;
    Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_isEditing ? "Editar refeicao" : "Nova refeicao")),
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [Color(0xFF06142F), Color(0xFF070D1E), Color(0xFF121827)],
          ),
        ),
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _Glass(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _DarkField(
                    controller: _nameController,
                    label: "Nome da refeicao",
                    icon: Icons.fastfood_outlined,
                  ),
                  const SizedBox(height: 12),
                  _DarkField(
                    controller: _caloriesController,
                    label: "Quantas calorias essa refeicao tem?",
                    icon: Icons.local_fire_department_outlined,
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _mealType,
                    items: const [
                      DropdownMenuItem(value: "Cafe da manha", child: Text("Cafe da manha")),
                      DropdownMenuItem(value: "Almoco", child: Text("Almoco")),
                      DropdownMenuItem(value: "Jantar", child: Text("Jantar")),
                      DropdownMenuItem(value: "Lanche", child: Text("Lanche")),
                    ],
                    onChanged: (value) {
                      if (value != null) setState(() => _mealType = value);
                    },
                    decoration: _fieldDecoration("Tipo de refeicao", icon: Icons.restaurant_menu),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _pickImage,
                    icon: const Icon(Icons.photo_library_outlined),
                    label: const Text("Escolher foto da galeria"),
                  ),
                  if (_photoPath != null && _photoPath!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(12),
                      child: _previewImage(_photoPath!),
                    ),
                  ],
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: _busy ? null : _save,
                    child: Text(_isEditing ? "Salvar alteracoes" : "Salvar refeicao"),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DarkField extends StatelessWidget {
  const _DarkField({
    required this.controller,
    required this.label,
    this.icon,
    this.keyboardType,
    this.obscureText = false,
  });

  final TextEditingController controller;
  final String label;
  final IconData? icon;
  final TextInputType? keyboardType;
  final bool obscureText;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      decoration: _fieldDecoration(label, icon: icon),
    );
  }
}

class _Glass extends StatelessWidget {
  const _Glass({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.045),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.16)),
      ),
      child: child,
    );
  }
}

class _MealTile extends StatelessWidget {
  const _MealTile({
    required this.meal,
    required this.onEdit,
    required this.onDelete,
  });

  final Meal meal;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.03),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (meal.photoPath != null && meal.photoPath!.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: _previewImage(meal.photoPath!, height: 120),
            ),
          if (meal.photoPath != null && meal.photoPath!.isNotEmpty) const SizedBox(height: 8),
          Text(
            "${meal.mealType}: ${meal.name}",
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
          ),
          Text(
            "${meal.calories} kcal",
            style: TextStyle(color: Colors.white.withOpacity(0.8)),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: onEdit,
                icon: const Icon(Icons.edit),
                label: const Text("Editar"),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline),
                label: const Text("Excluir"),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NumberDialog extends StatelessWidget {
  const _NumberDialog({
    required this.title,
    required this.controller,
    required this.actionText,
  });

  final String title;
  final TextEditingController controller;
  final String actionText;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(hintText: "Digite um valor"),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text("Cancelar"),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, true),
          child: Text(actionText),
        ),
      ],
    );
  }
}

class Meal {
  const Meal({
    this.id,
    required this.userId,
    required this.name,
    required this.calories,
    required this.mealType,
    required this.photoPath,
    required this.createdAt,
  });

  final int? id;
  final int userId;
  final String name;
  final int calories;
  final String mealType;
  final String? photoPath;
  final String createdAt;

  factory Meal.fromMap(Map<String, Object?> map) {
    return Meal(
      id: map["id"] as int?,
      userId: map["user_id"] as int,
      name: map["name"] as String,
      calories: map["calories"] as int,
      mealType: map["meal_type"] as String,
      photoPath: map["photo_path"] as String?,
      createdAt: map["created_at"] as String,
    );
  }

  Map<String, Object?> toMap() {
    return {
      "id": id,
      "user_id": userId,
      "name": name,
      "calories": calories,
      "meal_type": mealType,
      "photo_path": photoPath,
      "created_at": createdAt,
    };
  }
}

class AppDatabase {
  AppDatabase._();
  static final AppDatabase instance = AppDatabase._();
  Database? _db;

  Future<void> init() async {
    if (_db != null) return;
    late final String path;
    if (kIsWeb) {
      databaseFactory = databaseFactoryFfiWeb;
      path = "prime_diet_flutter.db";
    } else {
      final dbPath = await getDatabasesPath();
      path = p.join(dbPath, "prime_diet_flutter.db");
    }

    _db = await openDatabase(
      path,
      version: 1,
      onCreate: (db, _) async {
        await db.execute("""
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
          )
        """);
        await db.execute("""
          CREATE TABLE meals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            calories INTEGER NOT NULL,
            meal_type TEXT NOT NULL,
            photo_path TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id)
          )
        """);
      },
    );
  }

  Future<Database> get database async {
    await init();
    return _db!;
  }

  Future<bool> register(String name, String email, String password) async {
    final db = await database;
    final existing = await db.query(
      "users",
      columns: ["id"],
      where: "email = ?",
      whereArgs: [email],
      limit: 1,
    );
    if (existing.isNotEmpty) return false;

    await db.insert("users", {
      "name": name,
      "email": email,
      "password_hash": _hash(password),
      "created_at": DateTime.now().toIso8601String(),
    });
    return true;
  }

  Future<int?> login(String email, String password) async {
    final db = await database;
    final rows = await db.query(
      "users",
      columns: ["id", "password_hash"],
      where: "email = ?",
      whereArgs: [email],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    final row = rows.first;
    if (row["password_hash"] != _hash(password)) return null;
    return row["id"] as int;
  }

  Future<List<Meal>> getMealsByDate(int userId, DateTime date) async {
    final db = await database;
    final rows = await db.query(
      "meals",
      where: "user_id = ?",
      whereArgs: [userId],
      orderBy: "created_at DESC",
    );
    final target = _dateOnly(date);
    return rows
        .map(Meal.fromMap)
        .where((meal) {
          final parsed = DateTime.tryParse(meal.createdAt);
          return parsed != null && DateUtils.isSameDay(_dateOnly(parsed), target);
        })
        .toList();
  }

  Future<void> insertMeal(Meal meal) async {
    final db = await database;
    await db.insert("meals", meal.toMap()..remove("id"));
  }

  Future<void> updateMeal(int userId, Meal meal) async {
    final db = await database;
    await db.update(
      "meals",
      meal.toMap()..remove("id"),
      where: "id = ? AND user_id = ?",
      whereArgs: [meal.id, userId],
    );
  }

  Future<void> deleteMeal(int userId, int mealId) async {
    final db = await database;
    await db.delete(
      "meals",
      where: "id = ? AND user_id = ?",
      whereArgs: [mealId, userId],
    );
  }

  String _hash(String value) => sha256.convert(utf8.encode(value)).toString();
}

class SessionStore {
  static const _sessionUserIdKey = "prime_diet_session_user_id";
  static const _waterPrefix = "prime_diet_water_ml_";
  static const _goalPrefix = "prime_diet_goal_";

  static Future<void> setUserId(int userId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_sessionUserIdKey, userId);
  }

  static Future<int?> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_sessionUserIdKey);
  }

  static Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_sessionUserIdKey);
  }

  static Future<int> getWaterMl(int userId, DateTime date) async {
    final prefs = await SharedPreferences.getInstance();
    final dayKey = "${date.year}-${date.month}-${date.day}";
    return prefs.getInt("$_waterPrefix$userId-$dayKey") ?? 1500;
  }

  static Future<void> setWaterMl(int userId, DateTime date, int value) async {
    final prefs = await SharedPreferences.getInstance();
    final dayKey = "${date.year}-${date.month}-${date.day}";
    await prefs.setInt("$_waterPrefix$userId-$dayKey", value);
  }

  static Future<int> getCaloriesGoal(int userId) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt("$_goalPrefix$userId") ?? 2000;
  }

  static Future<void> setCaloriesGoal(int userId, int value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt("$_goalPrefix$userId", value);
  }
}

InputDecoration _fieldDecoration(String label, {IconData? icon}) {
  return InputDecoration(
    labelText: label,
    labelStyle: TextStyle(color: Colors.white.withOpacity(0.8)),
    prefixIcon: icon == null ? null : Icon(icon, color: Colors.white.withOpacity(0.62)),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
    filled: true,
    fillColor: Colors.white.withOpacity(0.06),
    enabledBorder: OutlineInputBorder(
      borderRadius: BorderRadius.circular(12),
      borderSide: BorderSide(color: Colors.white.withOpacity(0.18)),
    ),
    focusedBorder: const OutlineInputBorder(
      borderRadius: BorderRadius.all(Radius.circular(12)),
      borderSide: BorderSide(color: Color(0xFF7DDAA5)),
    ),
  );
}

Widget _previewImage(String path, {double height = 180}) {
  if (kIsWeb) {
    return Image.network(
      path,
      height: height,
      fit: BoxFit.cover,
      errorBuilder: (_, __, ___) => const SizedBox(height: 24),
    );
  }
  return Image.file(
    File(path),
    height: height,
    fit: BoxFit.cover,
    errorBuilder: (_, __, ___) => const SizedBox(height: 24),
  );
}

DateTime _dateOnly(DateTime date) => DateTime(date.year, date.month, date.day);

String formatDatePt(DateTime date) {
  const months = [
    "janeiro",
    "fevereiro",
    "marco",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  return "${date.day} de ${months[date.month - 1]}";
}

String dayLabelPt(DateTime date) {
  const week = [
    "Segunda",
    "Terca",
    "Quarta",
    "Quinta",
    "Sexta",
    "Sabado",
    "Domingo",
  ];
  final idx = date.weekday - 1;
  return "${week[idx]}, ${formatDatePt(date)}";
}
