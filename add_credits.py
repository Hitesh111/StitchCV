# import asyncio
# from stitchcv.models.database import get_session
# from stitchcv.models.user import User
# from sqlalchemy import select

# async def add_credits():
#     async with get_session() as session:
#         result = await session.execute(select(User))
#         users = result.scalars().all()
#         for user in users:
#             user.credits += 100
#             print(f"Success: {user.email} now has {user.credits} credits.")
#         await session.commit()

# if __name__ == "__main__":
#     asyncio.run(add_credits())
