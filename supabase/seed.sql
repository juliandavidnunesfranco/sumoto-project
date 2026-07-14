-- =============================================================================
-- SEED DE DEMO — SUMOTO. Corre en cada `pnpm supabase db reset`.
-- Tiendas, usuarios por rol (password: sumoto123), productos con reglas JSONB
-- y 18 créditos con historias variadas: al día, mora 30, 60 y 90+.
-- =============================================================================

-- 1. Tiendas ------------------------------------------------------------------
insert into public.tiendas (id, nombre, ciudad) values
  ('11111111-1111-4111-8111-111111111111', 'SUMOTO Bogotá Norte', 'Bogotá'),
  ('22222222-2222-4222-8222-222222222222', 'SUMOTO Medellín Centro', 'Medellín');

-- 2. Usuarios por rol (auth) + perfiles ----------------------------------------
do $$
declare
  usuarios constant jsonb := '[
    {"id":"a0000000-0000-4000-8000-000000000001","email":"vendedor@sumoto.co","rol":"vendedor","nombre":"Valentina Vendedora","tienda":"11111111-1111-4111-8111-111111111111"},
    {"id":"a0000000-0000-4000-8000-000000000002","email":"manager@sumoto.co","rol":"manager","nombre":"Mario Manager","tienda":"11111111-1111-4111-8111-111111111111"},
    {"id":"a0000000-0000-4000-8000-000000000003","email":"financiero@sumoto.co","rol":"financiero","nombre":"Fernanda Financiera","tienda":null},
    {"id":"a0000000-0000-4000-8000-000000000004","email":"contable@sumoto.co","rol":"contable","nombre":"Carlos Contable","tienda":null},
    {"id":"a0000000-0000-4000-8000-000000000005","email":"ceo@sumoto.co","rol":"ceo","nombre":"Camila CEO","tienda":null},
    {"id":"a0000000-0000-4000-8000-000000000006","email":"vendedor.medellin@sumoto.co","rol":"vendedor","nombre":"Víctor Vendedor","tienda":"22222222-2222-4222-8222-222222222222"}
  ]';
  u jsonb;
begin
  for u in select * from jsonb_array_elements(usuarios) loop
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', (u->>'id')::uuid,
      'authenticated', 'authenticated', u->>'email',
      extensions.crypt('sumoto123', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(),
      '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), (u->>'id')::uuid, u->>'id',
      jsonb_build_object('sub', u->>'id', 'email', u->>'email',
                         'email_verified', true),
      'email', now(), now(), now()
    );
    insert into public.perfiles (user_id, rol, tienda_id, nombre)
    values ((u->>'id')::uuid, (u->>'rol')::public.rol_usuario,
            (u->>'tienda')::uuid, u->>'nombre');
  end loop;
end $$;

-- 3. Productos de crédito con reglas JSONB -------------------------------------
insert into originacion.productos_credito
  (id, nombre, tasa_ea, plazo_min_meses, plazo_max_meses, reglas_decision) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'Moto Fácil', 0.245, 6, 36,
   '{"score_minimo": 600, "score_revision": 650,
     "cuota_maxima_porcentaje_ingreso": 0.35, "ltv_maximo": 0.90,
     "ingreso_minimo_centavos": 130000000, "mora_maxima_dias": 60}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'Moto Premium', 0.219, 12, 48,
   '{"score_minimo": 680, "score_revision": 720,
     "cuota_maxima_porcentaje_ingreso": 0.30, "ltv_maximo": 0.80,
     "ingreso_minimo_centavos": 300000000, "mora_maxima_dias": 30}');

-- 4. Catálogo de motos (módulo catalogo) — contado y crédito son precios
--    DISTINTOS a propósito. `imagen` guarda solo el nombre del objeto en el
--    bucket Storage "motos" (público); la URL pública la resuelve el
--    repositorio del core, no aquí. ---------------------------------------------
insert into catalogo.motos
  (nombre, categoria, imagen, precio_contado_centavos, precio_credito_centavos,
   cilindraje, potencia, frenos, rendimiento)
values
  ('SUMOTO Street 125', 'Urbana', 'street-125.png',
   720000000, 830000000, '125cc', '10,5 HP', 'Disco/Tambor', '45 km/l'),
  ('SUMOTO Trail 200', 'Doble propósito', 'trail-200.png',
   1150000000, 1320000000, '200cc', '18 HP', 'Disco/Disco', '38 km/l'),
  ('SUMOTO Sport 250', 'Deportiva', 'sport-250.png',
   1680000000, 1930000000, '250cc', '27 HP', 'Disco ABS', '30 km/l'),
  ('SUMOTO Cargo 150', 'Trabajo', 'cargo-150.png',
   890000000, 1020000000, '150cc', '12 HP', 'Disco/Tambor', '42 km/l'),
  ('SUMOTO Scooter 125', 'Scooter', 'scooter-125.png',
   780000000, 900000000, '125cc', '9 HP', 'CBS', '48 km/l'),
  ('SUMOTO Naked 300', 'Naked', 'naked-300.png',
   2150000000, 2480000000, '300cc', '34 HP', 'Disco ABS', '26 km/l');

-- 5. 18 créditos con historia (cliente + solicitud + decisión + crédito +
--    plan francés + pagos según su categoría de mora) --------------------------
do $$
declare
  nombres  constant text[] := array['Carlos','María','Andrés','Luisa','Jorge','Camila','Pedro','Diana','Felipe','Laura','Óscar','Paula','Ricardo','Sofía','Tomás','Valeria','Wilson','Ximena'];
  apellidos constant text[] := array['Rodríguez','Gómez','Martínez','López','Torres','Rojas','Pérez','Ramírez','Moreno','Castro','Vargas','Ortiz','Silva','Cárdenas','Mejía','Suárez','Pineda','Acosta'];
  tiendas  constant uuid[] := array['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
  producto constant uuid := 'bbbbbbbb-0000-4000-8000-000000000001';
  tasa_ea  constant numeric := 0.245;
  tasa_mora constant numeric := 0.38;

  i int; plazo int; n int;
  tienda uuid; v_cliente uuid; v_solicitud uuid; v_credito uuid; v_pago uuid; v_moto uuid;
  cuota_row record;
  valor_moto bigint; cuota_inicial bigint; monto bigint; ingresos bigint;
  i_m numeric; cuota bigint; interes bigint; capital bigint; saldo bigint;
  desembolso date; f_venc date;
  meses_atras int; sin_pagar int; vencidas int; a_pagar int;
begin
  for i in 1..18 loop
    tienda := tiendas[1 + (i % 2)];
    valor_moto := (600000000 + i * 40000000);          -- $6.0M a $13.2M
    cuota_inicial := valor_moto / 5;                    -- 20% de inicial
    monto := valor_moto - cuota_inicial;
    ingresos := 250000000 + (i % 5) * 50000000;         -- $2.5M a $4.5M
    plazo := 12 + (i % 3) * 6;                          -- 12 / 18 / 24 meses
    meses_atras := 5 + (i % 7);                         -- desembolsos 5-11 meses atrás
    -- offset de días para poblar todas las franjas de mora
    desembolso := (current_date - (meses_atras || ' months')::interval
                   - ((i % 3) * 12 || ' days')::interval)::date;
    -- mitad al día; el resto reparte mora: ~30, ~60 y 90+ (cuotas sin pagar)
    sin_pagar := case
      when i % 6 in (0, 1, 2) then 0
      when i % 6 = 3 then 1
      when i % 6 = 4 then 2
      else 3 + ((i / 6) % 2)
    end;

    -- cliente
    insert into clientes.clientes
      (cedula, nombres, apellidos, fecha_nacimiento, telefono, ciudad,
       ingresos_declarados_centavos, fuente_identidad, tienda_id)
    values
      ((1000000000 + i)::text, nombres[i], apellidos[i] || ' ' || apellidos[1 + (i % 18)],
       ('1975-01-15'::date + (i * 400 || ' days')::interval)::date,
       '31055512' || lpad(i::text, 2, '0'), case when i % 2 = 0 then 'Bogotá' else 'Medellín' end,
       ingresos, case when i % 3 = 0 then 'escaner' else 'entrada_manual' end, tienda)
    returning id into v_cliente;

    -- moto financiada (cualquiera del catálogo ya sembrado arriba)
    select id into v_moto from catalogo.motos order by random() limit 1;

    -- solicitud evaluada y desembolsada + decisión APROBADO;
    -- creado_por = el vendedor de la tienda correspondiente
    insert into originacion.solicitudes
      (cliente_id, producto_id, moto_id, tienda_id, valor_moto_centavos,
       cuota_inicial_centavos, plazo_meses, ingresos_declarados_centavos, estado, creado_en,
       creado_por)
    values (v_cliente, producto, v_moto, tienda, valor_moto, cuota_inicial, plazo,
            ingresos, 'desembolsada', desembolso - 2,
            case when tienda = tiendas[1]
              then 'a0000000-0000-4000-8000-000000000001'::uuid
              else 'a0000000-0000-4000-8000-000000000006'::uuid
            end)
    returning id into v_solicitud;

    -- cuota francesa (misma fórmula del core: EA -> mensual)
    i_m := power(1 + tasa_ea, 1.0/12) - 1;
    cuota := round(monto * i_m / (1 - power(1 + i_m, -plazo)));

    insert into originacion.decisiones
      (solicitud_id, resultado, razones, score, cuota_estimada_centavos, evaluado_en)
    values (v_solicitud, 'APROBADO',
            jsonb_build_array('score supera el mínimo', 'cuota dentro de capacidad', 'LTV dentro del máximo'),
            660 + (i * 13) % 240, cuota, desembolso - 2);

    -- crédito (snapshot de condiciones)
    insert into cartera.creditos
      (cliente_id, tienda_id, monto_desembolsado_centavos, tasa_ea, tasa_mora_ea,
       plazo_meses, cuota_centavos, estado, desembolsado_en)
    values (v_cliente, tienda, monto, tasa_ea, tasa_mora, plazo, cuota, 'activo', desembolso)
    returning id into v_credito;

    insert into links.solicitud_credito (solicitud_id, credito_id)
    values (v_solicitud, v_credito);

    -- plan de cuotas
    saldo := monto;
    for n in 1..plazo loop
      interes := round(saldo * i_m);
      if n < plazo then capital := cuota - interes; else capital := saldo; end if;
      saldo := saldo - capital;
      f_venc := (desembolso + (n || ' months')::interval)::date;
      insert into cartera.cuotas
        (credito_id, numero, fecha_vencimiento, capital_centavos, interes_centavos)
      values (v_credito, n, f_venc, capital, interes);
    end loop;

    -- pagos: paga las cuotas vencidas menos `sin_pagar` (deja mora escalonada)
    select count(*) into vencidas from cartera.cuotas q
      where q.credito_id = v_credito and q.fecha_vencimiento < current_date;
    a_pagar := greatest(vencidas - sin_pagar, 0);

    for cuota_row in
      select * from cartera.cuotas q
      where q.credito_id = v_credito
      order by q.numero
      limit a_pagar
    loop
      insert into cartera.pagos (credito_id, monto_centavos, fecha_pago)
      values (v_credito, cuota_row.capital_centavos + cuota_row.interes_centavos,
              cuota_row.fecha_vencimiento)
      returning id into v_pago;

      insert into cartera.aplicaciones_pago (pago_id, cuota_id, componente, monto_centavos)
      values (v_pago, cuota_row.id, 'interes', cuota_row.interes_centavos),
             (v_pago, cuota_row.id, 'capital', cuota_row.capital_centavos);

      update cartera.cuotas set
        capital_pagado_centavos = capital_centavos,
        interes_pagado_centavos = interes_centavos
      where id = cuota_row.id;
    end loop;
  end loop;
end $$;

-- 6. Citas de agenda del manager (módulo agenda) — fechas RELATIVAS a hoy
--    para que el banner ("próximas 48h") y el calendario siempre tengan datos.
insert into agenda.citas (tienda_id, creado_por, titulo, tipo, cliente_cedula, fecha_hora, notas) values
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000002',
   'Visita de Diana Ramírez — entrega de documentos', 'visita', '1000000008',
   current_date + interval '15 hours', 'Trae pagaré firmado'),
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000002',
   'Reunión semanal de vendedores', 'reunion', null,
   current_date + interval '1 day 13 hours', 'Revisión de metas de colocación'),
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000002',
   'Visita de María Gómez — prueba de manejo Sport 250', 'visita', '1000000002',
   current_date + interval '1 day 20 hours', null),
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000002',
   'Llamada con financiero — política de cuota inicial', 'reunion', null,
   current_date + interval '4 days 14 hours', null),
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000002',
   'Visita de Laura Castro — segunda moto', 'visita', '1000000010',
   current_date + interval '8 days 16 hours', null),
  ('11111111-1111-4111-8111-111111111111', 'a0000000-0000-4000-8000-000000000002',
   'Inventario de motos con bodega', 'reunion', null,
   current_date + interval '12 days 21 hours', null);
