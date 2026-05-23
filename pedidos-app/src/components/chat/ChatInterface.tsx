"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Send, Check, MoreVertical, Phone, ShoppingCart } from 'lucide-react';

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
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [conversationState, setConversationState] = useState<ConversationState>('awaiting_name');
  const [customerData, setCustomerData] = useState<CustomerData>({ name: '', email: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    setMessages([{
      id: '1',
      type: 'bot',
      content: '¡Hola! 👋 ¿Cuál es tu nombre?',
      timestamp: new Date()
    }]);
    setConversationState('awaiting_name');
  }, []);

  // ── Seleccionar imagen → auto-OCR inmediato ──
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileInputRef.current) fileInputRef.current.value = '';

    const url = URL.createObjectURL(file);

    // Mostrar imagen en el chat de inmediato
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'user',
      imageUrl: url,
      timestamp: new Date()
    }]);

    // Indicador de lectura
    setIsProcessing(true);
    setMessages(prev => [...prev, {
      id: 'ocr-loading',
      type: 'bot',
      content: '🔍 Leyendo referencia del producto...',
      timestamp: new Date()
    }]);

    try {
      // Enviar al servidor para OCR (más preciso que en el browser)
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/ocr', { method: 'POST', body: formData });
      const data = await res.json();

      // Quitar el mensaje de "leyendo..."
      setMessages(prev => prev.filter(m => m.id !== 'ocr-loading'));

      if (data.success && data.data?.ref) {
        const { ref, name } = data.data;
        const notInInventory = data.warning;

        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: notInInventory
            ? `⚠️ Detecté REF: ${ref} — pero no está en el inventario.\n¿Cuántas unidades igual? (o sube otra foto)`
            : `✅ Detecté:\n📦 ${name}\n🏷️ REF: ${ref}\n\n¿Cuántas unidades?`,
          metadata: { ref, name, pendingQuantity: true },
          timestamp: new Date()
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'bot',
          content: '❌ No logré leer la referencia. Asegúrate de que el código sea visible y la foto esté nítida. Intenta de nuevo.',
          timestamp: new Date()
        }]);
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== 'ocr-loading'));
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'bot',
        content: 'Error al procesar la imagen. Intenta de nuevo.',
        timestamp: new Date()
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Pegar imagen con Ctrl+V ──
  // ── Enviar mensaje ──
  const handleSend = async () => {
    if (!inputText.trim()) return;

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
    setInputText('');

    // Mostrar texto del usuario
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      type: 'user',
      content: currentText,
      timestamp: new Date()
    }]);

    // ── Solo texto → responder cantidad pendiente ──
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
        status: 'Pendiente',
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
    <div className="flex flex-col max-w-md mx-auto bg-[#efeae2] shadow-xl relative overflow-hidden" style={{ height: '100dvh' }}>
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
      <div className="bg-[#f0f2f5] px-2 pt-2 flex flex-col gap-2" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))' }}>
        <div className="flex items-end gap-2">
          <div className="flex-1 bg-white rounded-full px-4 py-2.5 flex items-center gap-2 shadow-sm min-h-[44px]">
            {/* Input oculto para seleccionar imagen — cámara + galería */}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={conversationState !== 'ready' || isProcessing}
              className={`flex-shrink-0 transition-colors ${
                conversationState === 'ready' && !isProcessing
                  ? 'text-[#00a884] hover:text-[#008f6f]'
                  : 'text-gray-200 cursor-not-allowed'
              }`}
              title="Tomar foto o subir imagen"
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
                  : isProcessing
                  ? 'Analizando imagen...'
                  : 'Escribe la cantidad o un mensaje...'
              }
              className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={isProcessing}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isProcessing}
            className={`p-3 rounded-full shadow-sm transition-all flex-shrink-0 ${
              inputText.trim() && !isProcessing
                ? 'bg-[#00a884] text-white hover:bg-[#008f6f] active:scale-95'
                : 'bg-[#00a884] text-white opacity-50 cursor-not-allowed'
            }`}
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
