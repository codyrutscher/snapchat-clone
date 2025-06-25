import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import SubscriptionService from '../services/SubscriptionService';

export default function PayPalSubscription({ onSuccess, onError }) {
  const webViewRef = useRef(null);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          margin: 0;
          padding: 20px;
          background-color: #f5f5f5;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
        }
        #paypal-button-container-P-41W63194FL822090CNBJOTNI {
          width: 100%;
          max-width: 400px;
        }
      </style>
    </head>
    <body>
      <div id="paypal-button-container-P-41W63194FL822090CNBJOTNI"></div>
      <script src="https://www.paypal.com/sdk/js?client-id=AVbw_NO4dcbC-ZbzqzBkWuzhI_5D3pBZoCmfc29aCquHdga0lHxIZIPbLI3qCFY5wO_mOZSfhwAo5fQM&vault=true&intent=subscription" data-sdk-integration-source="button-factory"></script>
      <script>
        paypal.Buttons({
          style: {
            shape: 'rect',
            color: 'gold',
            layout: 'vertical',
            label: 'subscribe'
          },
          createSubscription: function(data, actions) {
            return actions.subscription.create({
              plan_id: 'P-41W63194FL822090CNBJOTNI'
            });
          },
          onApprove: function(data, actions) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'subscription_approved',
              subscriptionID: data.subscriptionID
            }));
          },
          onError: function(err) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'subscription_error',
              error: err.toString()
            }));
          }
        }).render('#paypal-button-container-P-41W63194FL822090CNBJOTNI');
      </script>
    </body>
    </html>
  `;

  const handleMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'subscription_approved') {
        await SubscriptionService.updateSubscriptionStatus(data.subscriptionID);
        if (onSuccess) onSuccess(data.subscriptionID);
      } else if (data.type === 'subscription_error') {
        if (onError) onError(data.error);
      }
    } catch (error) {
      console.error('PayPal message error:', error);
    }
  };

  if (Platform.OS === 'web') {
    // For web, we'll render the PayPal button differently
    return (
      <View style={styles.container}>
        <Text style={styles.webText}>
          PayPal subscription is available on mobile apps only.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        onMessage={handleMessage}
        style={styles.webView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    overflow: 'hidden',
  },
  webView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webText: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
  },
});