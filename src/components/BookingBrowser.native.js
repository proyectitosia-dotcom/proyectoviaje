import React, { useRef, useState } from 'react';
import { Modal, View, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, Muted, Text, useTheme } from './ui';

// Lee de la página de un hotel de Booking: nombre, dirección, coordenadas y precio
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
  function txt(sel){var e=document.querySelector(sel);return e?e.textContent.replace(/\\s+/g,' ').trim():'';}
  if(!d.name) d.name=txt('#hp_hotel_name')||txt('h2.pp-header__title')||txt('[data-testid="property-name"]')||txt('h2');
  if(!d.address) d.address=txt('[data-testid="address"]')||txt('#hp_address_subtitle')||txt('.hp_address_subtitle');
  if(!d.lat){var m=document.querySelector('[data-atlas-latlng]'); if(m){var ll=m.getAttribute('data-atlas-latlng').split(','); d.lat=parseFloat(ll[0]); d.lng=parseFloat(ll[1]);}}
  function parse(t){var x=(t||'').replace(/[^0-9.,]/g,''); if(!x) return 0;
    var lc=x.lastIndexOf(','), ld=x.lastIndexOf('.'), sep=Math.max(lc,ld);
    if(sep<0) return parseFloat(x);
    var dec=x.length-sep-1;
    if((lc>=0&&ld>=0)||dec!==3) return parseFloat(x.slice(0,sep).replace(/[.,]/g,'')+'.'+x.slice(sep+1));
    return parseFloat(x.replace(/[.,]/g,''));}
  var best=0, bestTxt='';
  document.querySelectorAll('[data-testid="price-and-discounted-price"],.prco-valign-middle-helper,.bui-price-display__value,.hprt-price-price,[data-testid="price-for-x-nights"]').forEach(function(e){
    var t=e.textContent.replace(/\\s+/g,' ').trim(), v=parse(t);
    if(v>0 && (!best||v<best)){best=v;bestTxt=t;}
  });
  if(best){d.price=best; d.priceText=bestTxt;}
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
            {info.priceText ? <Muted>Precio detectado: {info.priceText}</Muted> : null}
            <Btn title="✔ Usar este hotel (guarda enlaces de Booking y Maps)" kind="ok" onPress={pick} />
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
