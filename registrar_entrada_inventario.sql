ALTER TABLE public.movimientos_inventario
    ALTER COLUMN operacion_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.registrar_entrada_inventario(
    p_producto_id bigint,
    p_cantidad numeric,
    p_motivo text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_usuario_id uuid := auth.uid();
    v_rol text;
    v_movimiento_id bigint;
BEGIN
    IF v_usuario_id IS NULL THEN
        RAISE EXCEPTION 'Se requiere una sesión activa.'
            USING ERRCODE = '42501';
    END IF;

    SELECT u.rol
      INTO v_rol
      FROM public.usuarios AS u
     WHERE u.id = v_usuario_id
       AND u.activo IS TRUE;

    IF v_rol IS DISTINCT FROM 'administrador' THEN
        RAISE EXCEPTION 'Solo un administrador activo puede registrar entradas.'
            USING ERRCODE = '42501';
    END IF;

    IF p_producto_id IS NULL
       OR p_cantidad IS NULL
       OR p_cantidad <= 0
       OR p_cantidad::text IN ('NaN', 'Infinity', '-Infinity')
       OR NULLIF(BTRIM(p_motivo), '') IS NULL
       OR LENGTH(BTRIM(p_motivo)) > 500 THEN
        RAISE EXCEPTION 'Producto, cantidad positiva y motivo válido son obligatorios.'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.productos
       SET existencia = COALESCE(existencia, 0) + p_cantidad
     WHERE id = p_producto_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto seleccionado no existe.'
            USING ERRCODE = '23503';
    END IF;

    INSERT INTO public.movimientos_inventario (
        producto_id,
        tipo,
        cantidad,
        motivo,
        operacion_id,
        fecha,
        usuario_id,
        pendiente_envio
    ) VALUES (
        p_producto_id,
        'entrada',
        p_cantidad,
        BTRIM(p_motivo),
        NULL,
        NOW(),
        v_usuario_id,
        FALSE
    )
    RETURNING id INTO v_movimiento_id;

    RETURN v_movimiento_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_entrada_inventario(bigint, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.registrar_entrada_inventario(bigint, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrada_inventario(bigint, numeric, text) TO authenticated;