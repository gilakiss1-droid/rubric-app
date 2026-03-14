export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, filename } = req.body;
    const content = text || ('שם הקובץ: ' + (filename || 'לא ידוע'));

    const prompt = `אתה מנתח תוכניות עבודה חינוכיות. קרא את הטקסט ובנה ממנו מחוון רפלקטיבי.

טקסט התוכנית:
"""
${content.substring(0, 7000)}
"""

החזר JSON בלבד (ללא markdown, ללא backticks), במבנה:
{"name":"שם התוכנית","org":"ארגון/מחוז","year":"שנה","sections":[{"label":"שם נושא","tasks":[{"id":"t1","num":"1","name":"שם המשימה","responsible":"מי אחראי","start":"תאריך התחלה","end":"תאריך סיום","outputs":"מדדי תפוקה","outcomes":"מדדי תוצאה","resources":"משאבים","resp_type":"sup"}]}],"wording_issues":[{"taskId":"t1","field":"תפוקה","orig":"הניסוח הקיים","improved":"הניסוח המשופר"}],"writing_summary":"סיכום איכות הכתיבה"}

כללים: resp_type=sup למפקח/ת, gui למדריך/ה. מצא 3-5 ניסוחים לשיפור. JSON בלבד.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'API error ' + response.status + ': ' + err.substring(0, 200) });
    }

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const raw = (data.content || []).find(b => b.type === 'text')?.text || '';
    if (!raw) return res.status(500).json({ error: 'Empty AI response' });

    let plan;
    try {
      plan = JSON.parse(raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim());
    } catch (e) {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) plan = JSON.parse(m[0]);
      else return res.status(500).json({ error: 'JSON parse failed', raw: raw.substring(0, 300) });
    }

    return res.status(200).json(plan);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
