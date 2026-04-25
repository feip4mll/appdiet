package com.valeverde.estoque;

import android.annotation.SuppressLint;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
  private WebView appWebView;
  private StockDatabaseHelper stockDatabaseHelper;

  @SuppressLint("SetJavaScriptEnabled")
  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    setContentView(R.layout.activity_main);

    stockDatabaseHelper = new StockDatabaseHelper(this);
    appWebView = findViewById(R.id.appWebView);

    WebSettings settings = appWebView.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(true);
    settings.setAllowContentAccess(true);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);

    appWebView.setWebViewClient(new WebViewClient());
    appWebView.addJavascriptInterface(
      new StockJavascriptBridge(stockDatabaseHelper),
      "AndroidDatabase"
    );
    appWebView.loadUrl("file:///android_asset/index.html");
  }

  @Override
  public void onBackPressed() {
    if (appWebView != null && appWebView.canGoBack()) {
      appWebView.goBack();
      return;
    }

    super.onBackPressed();
  }

  @Override
  protected void onDestroy() {
    if (appWebView != null) {
      appWebView.destroy();
    }

    if (stockDatabaseHelper != null) {
      stockDatabaseHelper.close();
    }

    super.onDestroy();
  }
}
