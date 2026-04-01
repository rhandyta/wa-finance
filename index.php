<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WA-Finance</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        h1 { font-size: 3rem; margin-bottom: 1rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
        .status { 
            background: rgba(255,255,255,0.2); 
            padding: 1.5rem 2rem; 
            border-radius: 12px; 
            margin: 2rem 0;
            backdrop-filter: blur(10px);
        }
        .status-icon { font-size: 3rem; margin-bottom: 1rem; }
        .links { margin-top: 2rem; }
        .links a {
            display: inline-block;
            margin: 0.5rem;
            padding: 0.75rem 1.5rem;
            background: white;
            color: #667eea;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            transition: transform 0.2s;
        }
        .links a:hover { transform: translateY(-2px); }
        .info { 
            background: rgba(0,0,0,0.2); 
            padding: 1rem; 
            border-radius: 8px; 
            margin-top: 2rem;
            font-family: monospace;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤑 WA-Finance</h1>
        <div class="status">
            <div class="status-icon">✅</div>
            <h2>Server Berjalan!</h2>
            <p>Aplikasi siap digunakan | PHP <?php echo phpversion(); ?></p>
        </div>
        <div class="links">
            <a href="/phpmyadmin">📊 phpMyAdmin</a>
            <a href="/phpmyadmin">🗄️ Database Manager</a>
        </div>
        <div class="info">
            <p>Server: <?php echo $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'; ?></p>
            <p>Time: <?php echo date('Y-m-d H:i:s'); ?> | TZ: Asia/Jakarta</p>
            <p>MySQL Host: mysql:3306</p>
        </div>
    </div>
</body>
</html>
