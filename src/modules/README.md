# Arquitectura modular

Cada modulo sigue estas capas:

- `domain`: tipos y reglas del dominio
- `application`: casos de uso y orquestacion
- `infrastructure`: implementaciones tecnicas (Supabase, APIs, repositorios)
- `ui`: componentes de presentacion y adaptadores de vistas

Modulos iniciales:
- `auth`
- `user`
- `wallet`
- `payments`
- `game`
- `admin`
- `shared`
