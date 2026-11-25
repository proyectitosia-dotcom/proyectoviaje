import React, { useRef, useState } from 'react';
import { Modal, View, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Muted, Text, useTheme } from './ui';

// Lee de la página de un hotel de Booking su nombre, dirección y coordenadas (JSON-LD)
const EXTRACT = `(function(){try{
  var d={url:location.href,title:document.title};
  var og=document.querySelector('meta[property="og:title"]'); if(og&&og.content) d.title=og.content;
  document.querySelectorAll('script[type="application/ld+json"]').forEach(function(s){try{
    var j=JSON.parse(s.textContent); var a=Array.isArray(j)?j:[j];
    a.forEach(function(o){ if(o&&/Hotel|Lodging|Hostel|Apartment|BedAndBreakfast|Resort/i.test(String(o['@type']||''))){
      d.name=o.name;
      if(o.address){ d.address=[o.address.streetAddress,o.address.postalCode,o.address.addressLocality].filter(Boolean).join(', '); d.city=o.address.addressLocality; }
      if(o.geo){ d.lat=o.geo.latitude; d.lng=o.geo.longitude; }
    }});
  }catch(e){}});
  window.ReactNativeWebView.postMessage(JSON.stringify(d));
}catch(e){} true;})();`;

const isHotelUrl = (u) => /booking\.com\/hotel\//i.test(u || '');
const cleanName = (t) => (t || '').replace(/\s*[,|·-]\s*(Booking\.com|updated prices.*|precios actualizados.*)$/i, '').split(' - ')[0].trim();

// Navegador de Booking dentro de la app. Al abrir la ficha de un hotel detecta sus datos
// y ofrece usarlos para rellenar el formulario (enlace de Booking y de Maps incluidos).
export default function BookingBrowser({ visible, url, onClose, onPick }) {
  const { colors } = useTheme();
  const ref = useRef(null);
  const [cur, setCur] = useState(url);
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const onNav = (nav) => {
    setCur(nav.url);
    if (!isHotelUrl(nav.url)) setInfo(null);
    else setInfo((i) => (i && i.url === nav.url ? i : { url: nav.url, name: '' }));
  };
  const onMsg = (e) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (isHotelUrl(d.url)) setInfo({ ...d, name: d.name || cleanName(d.title) });
    } catch (_) {}
  };
  const pick = () => { if (info) { onPick({ ...info, url: info.url.split('#')[0] }); } };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 : 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderBottomWidth: 1, borderColor: colors.border }}>
          <Btn small kind="outline" title="← Atrás" onPress={() => ref.current && ref.current.goBack()} />
          <Text style={{ flex: 1, fontWeight: '700' }} numberOfLines={1}>Booking.com</Text>
          <Btn small kind="outline" title="Cerrar" onPress={onClose} />
        </View>
        <View style={{ flex: 1 }}>
          <WebView
            ref={ref}
            source={{ uri: url }}
            onNavigationStateChange={onNav}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => { setLoading(false); ref.current && ref.current.injectJavaScript(EXTRACT); }}
            onMessage={onMsg}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            startInLoadingState
            renderLoading={() => <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />}
          />
          {loading ? <ActivityIndicator style={{ position: 'absolute', top: 10, right: 10 }} color={colors.primary} /> : null}
        </View>
        {info ? (
          <View style={{ padding: 10, gap: 6, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card }}>
            <Text style={{ fontWeight: '700' }} numberOfLines={2}>{info.name || 'Hotel de Booking'}</Text>
            {info.address ? <Muted>{info.address}</Muted> : null}
            <Btn title="✔ Usar este hotel (guarda enlaces de Booking y Maps)" kind="ok" onPress={pick} />
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
