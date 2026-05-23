"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Send, Check, MoreVertical, Phone, ShoppingCart } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import { supabase } from '@/lib/supabase';

interface OrderItem {
  ref: string;
  name: string;
  quantity: number;
}

interface Message {
  id: string;
  type: 'user' | 'system' | 'bot';
  content?: string;
  imageUrl?: string;
  timestamp: Date;
  metadata?: { ref?: string; name?: string; pendingQuantity?: boolean };
}

type ConversationState = 'awaiting_name' | 'awaiting_email' | 'ready';

interface CustomerData {
  name: string;
  email: string;
  id?: string;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ file: File; url: string } | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [conversationState, setConversationState] = useState<ConversationState>('awaiting_name');
  const [customerData, setCustomerData] = useState<CustomerData>({ name: '', email: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, previewImage]);

  useEffect(() => {
    setMessages([{
      id: '1',
      type: 'bot',
      content: '¡Hola! 👋 ¿Cuál es tu nombre?',
      timestamp: new Date()
    }]);
    setConversationState('awaiting_name');
  }, []);

  // ── Seleccionar imagen desde archivo ──
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewImage({ file, url: URL.createObjectURL(file) });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Pegar imagen con Ctrl+V ──
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) setPreviewImage({ file, url: URL.createObjectURL(file) });
        e.preventDefault();
        break;
      }
    }
  };

  // ── Leer imagen con OCR ──
  const runOCR = async (imageUrl: string): Promise<{ ref: string | null; rawText: string }> => {
    const worker = await createWorker('spa');
    const { data: { text } } = await worker.recognize(imageUrl);
    await worker.terminate();

    console.log('OCR texto:', text);

    let detectedRef: string | null = null;
    const refMatch = text.match(/REF[:\s]*([A-Za-z0-9\-]+)/i);
    if (refMatch) {
      detectedRef = refMatch[1].trim();
    } else {
      // Fallback: patrón alfanumérico con guión como "25872-2" o "PC-35"
      const fallback = text.match(/\b([A-Z]{1,4}-?\d{1,5}(?:-\d{1,2})?)\b/);
      if (fallback) detectedRef = fallback[1].trim();
    }
    return { ref: detectedRef, rawText: text };
  };

  // ── Buscar producto en Supabase ──
  const lookupProduct = async (ref: string): Promise<string> => {
    try {
      const { data } = await supabase
        .from('INVENTARIO EL PUNTAZO')
        .select('Producto, Referencia')
        .eq('Referencia', ref)
        .single();

      if (data?.Producto) return data.Producto;

      // Búsqueda flexible si no hay coincidencia exacta
      const { data: fuzzy } = await supabase
        .from('INVENTARIO EL PUNTAZO')
        .select('Producto, Referencia')
        .ilike('Referencia', `%${ref}%`)
        .limit(1);

      if (fuzzy && fuzzy.length > 0) return fuzzy[0].Producto;
    } catch (e) {
      console.error('Supabase lookup error:', e);
    }
    return 'Producto Desconocido';
  };

  // ── Enviar mensaje ──
  const handleSend = async () => {
    if (!inputText.trim() && !previewImage) return;

    // ─── CAPTURA DE NOMBRE ───
    if (conversationState === 'awaiting_name') {
      const name = inputText.trim();

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'user',
        content: name,
        timestamp: new Date()
      }]);

      setCustomerData(prev => ({ ...prev, name }));

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: `Perfecto, ${name}. ¿Cuál es tu email?`,
        timestamp: new Date()
      }]);

      setConversationState('awaiting_email');
      setInputText('');
      return;
    }

    // ─── CAPTURA Y VALIDACIÓN DE EMAIL ───
    if (conversationState === 'awaiting_email') {
      const email = inputText.trim();

      if (!email.includes('@') || !email.includes('.')) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: '❌ Email inválido. Por favor, usa un formato como: usuario@ejemplo.com',
          timestamp: new Date()
        }]);
        setInputText('');
        return;
      }

      setIsProcessing(true);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'user',
        content: email,
        timestamp: new Date()
      }]);

      try {
        const response = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: customerData.name, email })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.message);

        setCustomerData(prev => ({
          ...prev,
          email,
          id: data.customer.id
        }));

        const isNew = data.customer.isNew;
        const welcomeMsg = isNew
          ? `¡Bienvenido, ${customerData.name}! 🎉`
          : `¡Hola de nuevo, ${customerData.name}! 👋`;

        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          type: 'bot',
          content: `${welcomeMsg} Ahora sube las fotos de los productos que deseas pedir y escribe la cantidad. Yo armaré tu pedido automáticamente. 📦`,
          timestamp: new Date()
        }]);

        setConversationState('ready');
      } catch (error) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: `Error al registrar: ${error instanceof Error ? error.message : 'Intenta nuevamente'}`,
          timestamp: new Date()
        }]);
      } finally {
        setIsProcessing(false);
        setInputText('');
      }

      return;
    }

    const currentText = inputText.trim();
    const currentPreview = previewImage;

    // Mostrar mensaje del usuario en el chat
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'user',
      content: currentText || undefined,
      imageUrl: currentPreview?.url,
      timestamp: new Date()
    }]);
    setInputText('');
    setPreviewImage(null);

    // ── CASO 1: Hay imagen → OCR + búsqueda en catálogo ──
    if (currentPreview) {
      setIsProcessing(true);
      try {
        const { ref: detectedRef } = await runOCR(currentPreview.url);

        if (!detectedRef) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'bot',
            content: 'No logré leer la referencia en esta imagen. Asegúrate de que el texto REF sea visible.',
            timestamp: new Date()
          }]);
          return;
        }

        const productName = await lookupProduct(detectedRef);
        const quantityMatch = currentText.match(/\d+/);
        const quantity = quantityMatch ? parseInt(quantityMatch[0]) : null;

        if (quantity && quantity > 0) {
          // Tenemos ref + cantidad → agregar directo al pedido
          addToOrder(detectedRef, productName, quantity);
        } else {
          // Preguntar cantidad
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            type: 'bot',
            content: `Detecté:\nProducto: ${productName}\nREF: ${detectedRef}\n¿Cuántas unidades deseas?`,
            metadata: { ref: detectedRef, name: productName, pendingQuantity: true },
            timestamp: new Date()
          }]);
        }
      } catch (err) {
        console.error('Error procesando imagen:', err);
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: 'Ocurrió un error al leer la imagen. Intenta de nuevo.',
          timestamp: new Date()
        }]);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // ── CASO 2: Solo texto → responder cantidad pendiente ──
    const pendingBot = [...messages].reverse().find(
      m => m.type === 'bot' && m.metadata?.pendingQuantity
    );

    if (pendingBot?.metadata?.ref) {
      const quantityMatch = currentText.match(/\d+/);
      const quantity = quantityMatch ? parseInt(quantityMatch[0]) : null;

      if (quantity && quantity > 0) {
        addToOrder(
          pendingBot.metadata.ref,
          pendingBot.metadata.name || 'Producto',
          quantity
        );
        // Marcar el mensaje bot como resuelto
        setMessages(prev =>
          prev.map(m =>
            m.id === pendingBot.id
              ? { ...m, metadata: { ...m.metadata, pendingQuantity: false } }
              : m
          )
        );
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: 'No entendí la cantidad. Escribe un número, por ejemplo: 24',
          timestamp: new Date()
        }]);
      }
    }
  };

  // ── Agregar item al pedido (suma si ya existe) ──
  const addToOrder = (ref: string, name: string, quantity: number) => {
    setOrderItems(prev => {
      const existing = prev.find(i => i.ref === ref);
      if (existing) {
        return prev.map(i =>
          i.ref === ref ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { ref, name, quantity }];
    });

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'system',
      content: `✅ Agregado: ${quantity} und de ${name} (REF ${ref})`,
      timestamp: new Date()
    }]);
  };

  // ── Confirmar pedido → enviar al admin ──
  const handleConfirmOrder = async () => {
    if (orderItems.length === 0) {
      alert('No hay productos en el pedido. Agrega al menos uno.');
      return;
    }

    setIsSending(true);
    try {
      const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      const orderPayload = {
        id: orderId,
        customer: customerData.name,
        email: customerData.email,
        customer_id: customerData.id,
        phone: 'Por definir',
        items: orderItems,
        status: 'Pendientes',
        date: new Date().toLocaleDateString('es-ES'),
        total_items: orderItems.reduce((sum, i) => sum + i.quantity, 0)
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: `🎉 ¡Pedido ${data.order?.id || orderId} confirmado! La bodega ya lo recibió y lo está preparando.`,
          timestamp: new Date()
        }]);
        setOrderItems([]); // Limpiar pedido
      } else {
        throw new Error('Error en la respuesta del servidor');
      }
    } catch (e) {
      console.error('Error confirmando pedido:', e);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'bot',
        content: '❌ Hubo un error al confirmar el pedido. Intenta nuevamente.',
        timestamp: new Date()
      }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-[#efeae2] shadow-xl relative overflow-hidden">
      {/* Header */}
      <header className="bg-[#00a884] text-white p-3 flex items-center justify-between z-10 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold text-lg">
            B
          </div>
          <div>
            <h1 className="font-semibold leading-tight">Bodega Principal</h1>
            <p className="text-xs text-white/80">en línea</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Phone size={20} className="opacity-80" />
          <MoreVertical size={20} className="opacity-80" />
        </div>
      </header>

      {/* Chat Area */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-3"
        style={{ backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")', backgroundRepeat: 'repeat', backgroundSize: '400px' }}
      >
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : msg.type === 'system' ? 'justify-center' : 'justify-start'}`}>
            {msg.type === 'system' ? (
              <div className="bg-[#fffde7] border border-yellow-200 text-gray-700 text-xs px-3 py-1.5 rounded-full shadow-sm">
                {msg.content}
              </div>
            ) : (
              <div className={`max-w-[82%] rounded-2xl px-3 py-2 shadow-sm ${msg.type === 'user' ? 'bg-[#d9fdd3] rounded-tr-sm' : 'bg-white rounded-tl-sm'}`}>
                {msg.imageUrl && (
                  <img src={msg.imageUrl} alt="Producto" className="rounded-lg mb-1 max-h-72 w-auto object-contain" />
                )}
                {msg.content && (
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-snug">{msg.content}</p>
                )}
                <div className="flex justify-end items-center gap-1 mt-0.5">
                  <span className="text-[10px] text-gray-400">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.type === 'user' && <Check size={13} className="text-[#53bdeb]" />}
                </div>
              </div>
            )}
          </div>
        ))}

        {isProcessing && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex gap-1.5 items-center">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
              <span className="text-xs text-gray-400 ml-1">Analizando imagen...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Order Summary Bar */}
      <div className="bg-white border-t border-gray-100 px-3 py-2 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <ShoppingCart size={16} className="text-[#00a884]" />
          <span className="font-medium text-[#00a884]">{orderItems.length}</span>
          <span>{orderItems.length === 1 ? 'producto' : 'productos'}</span>
          {orderItems.length > 0 && (
            <span className="text-gray-400">
              ({orderItems.reduce((s, i) => s + i.quantity, 0)} und)
            </span>
          )}
        </div>
        <button
          onClick={handleConfirmOrder}
          disabled={isSending || orderItems.length === 0 || conversationState !== 'ready'}
          className={`text-sm px-4 py-1.5 rounded-full font-semibold transition-all shadow-sm ${
            orderItems.length > 0 && conversationState === 'ready'
              ? 'bg-[#00a884] text-white hover:bg-[#008f6f] active:scale-95'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {isSending ? 'Enviando...' : 'Confirmar Pedido'}
        </button>
      </div>

      {/* Input Area */}
      <div className="bg-[#f0f2f5] px-2 pt-2 pb-5 flex flex-col gap-2">
        {/* Preview de imagen antes de enviar */}
        {previewImage && (
          <div className="bg-white rounded-xl mx-1 p-2 shadow-sm relative flex items-center gap-2">
            <img src={previewImage.url} alt="Preview" className="h-20 w-20 object-contain rounded-lg border" />
            <p className="text-xs text-gray-500 flex-1">Imagen lista. Escribe la cantidad y presiona enviar.</p>
            <button
              onClick={() => setPreviewImage(null)}
              className="text-red-400 hover:text-red-600 font-bold text-lg leading-none"
            >×</button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 bg-white rounded-full px-4 py-2.5 flex items-center gap-2 shadow-sm min-h-[44px]">
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={conversationState !== 'ready'}
              className={`flex-shrink-0 ${conversationState === 'ready' ? 'text-gray-400 hover:text-gray-600' : 'text-gray-200 cursor-not-allowed'}`}
            >
              <Camera size={22} />
            </button>
            <input
              type="text"
              placeholder={
                conversationState === 'awaiting_name'
                  ? 'Escribe tu nombre...'
                  : conversationState === 'awaiting_email'
                  ? 'Escribe tu email...'
                  : previewImage ? 'Escribe la cantidad...' : 'Pega imagen o escribe...'
              }
              className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              onPaste={handlePaste}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputText.trim() && !previewImage}
            className={`p-3 rounded-full shadow-sm transition-all flex-shrink-0 ${
              inputText.trim() || previewImage
                ? 'bg-[#00a884] text-white hover:bg-[#008f6f] active:scale-95'
                : 'bg-[#00a884] text-white opacity-70'
            }`}
          >
            {previewImage || inputText.trim() ? <Send size={20} /> : <Camera size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}
