const expectEvent = require('./helpers/expectEvent');
const { shouldSupportInterfaces } = require('./SupportsInterface.behavior');
const shouldFail = require('./helpers/shouldFail');
const { ZERO_ADDRESS } = require('./helpers/constants');
const send = require('./helpers/send');
const ERC721ReceiverMock = artifacts.require('ERC721ReceiverMock.sol'); 

require('./helpers/setup');

function shouldBehaveLikeERC721 (
  creator,
  minter,
  [owner, approved, anotherApproved, operator, newOwner, anyone]
) {
  const firstTokenId = 1;
  const secondTokenId = 2;
  const thirdTokenId = 3;
  const unknownTokenId = 4;
  const RECEIVER_MAGIC_VALUE = '0x150b7a02';

  describe('like an ERC721', function () {
    beforeEach(async function () {
      await this.aragonnft.mint(owner, firstTokenId, { from: minter });
      await this.aragonnft.mint(owner, secondTokenId, { from: minter });
      this.toWhom = anyone; // default to anyone for toWhom in context-dependent tests
    });

    describe('mint', function () {
      let logs = null;

      describe('when successful', function () {
        beforeEach(async function () {
          const result = await this.aragonnft.mint(newOwner, thirdTokenId, { from: minter });
          logs = result.logs;
        });

        it('assigns the token to the new owner', async function () {
          (await this.aragonnft.ownerOf(thirdTokenId)).should.be.equal(newOwner);
        });

        it('increases the balance of its owner', async function () {
          (await this.aragonnft.balanceOf(newOwner)).should.be.bignumber.equal(1);
        });

        it('emits a transfer and minted event', async function () {
          expectEvent.inLogs(logs, 'Transfer', {
            _from: ZERO_ADDRESS,
            _to: newOwner,
            _tokenId: thirdTokenId,
          });
        });
      });

      describe('when the given owner address is the zero address', function () {
        it('reverts', async function () {
          await shouldFail.reverting(this.aragonnft.mint(ZERO_ADDRESS, thirdTokenId, { from: minter }));
        });
      });

      describe('when the given token ID was already tracked by this contract', function () {
        it('reverts', async function () {
          await shouldFail.reverting(this.aragonnft.mint(owner, firstTokenId, { from: minter }));
        });
      });
    });

    describe('ownerOf', function () {
      context('when the given token ID was tracked by this token', function () {
        const tokenId = firstTokenId;

        it('returns the owner of the given token ID', async function () {
          (await this.aragonnft.ownerOf(tokenId)).should.be.equal(owner);
        });
      });

      context('when the given token ID was not tracked by this token', function () {
        const tokenId = unknownTokenId;

        it('reverts', async function () {
          await shouldFail.reverting(this.aragonnft.ownerOf(tokenId));
        });
      });
    });


    describe('balanceOf', function () {
      context('when the given address owns some tokens', function () {
        it('returns the amount of tokens owned by the given address', async function () {
          (await this.aragonnft.balanceOf(owner)).should.be.bignumber.equal(2);
        });
      });

      context('when the given address does not own any tokens', function () {
        it('returns 0', async function () {
          (await this.aragonnft.balanceOf(anyone)).should.be.bignumber.equal(0);
        });
      });

      context('when querying the zero address', function () {
        it('throws', async function () {
          await shouldFail.reverting(this.aragonnft.balanceOf(0));
        });
      });
    });

    describe('approve', function () {
      const tokenId = firstTokenId;

      let logs = null;

      const itClearsApproval = function () {
        it('clears approval for the token', async function () {
          (await this.aragonnft.getApproved(tokenId)).should.be.equal(ZERO_ADDRESS);
        });
      };

      const itApproves = function (address) {
        it('sets the approval for the target address', async function () {
          (await this.aragonnft.getApproved(tokenId)).should.be.equal(address);
        });
      };

      const itEmitsApprovalEvent = function (address) {
        it('emits an approval event', async function () {
          expectEvent.inLogs(logs, 'Approval', {
            _owner: owner,
            _approved: address,
            _tokenId: tokenId,
          });
        });
      };

      context('when clearing approval', function () {
        context('when there was no prior approval', function () {
          beforeEach(async function () {
            ({ logs } = await this.aragonnft.approve(ZERO_ADDRESS, tokenId, { from: owner }));
          });

          itClearsApproval();
          itEmitsApprovalEvent(ZERO_ADDRESS);
        });

        context('when there was a prior approval', function () {
          beforeEach(async function () {
            await this.aragonnft.approve(approved, tokenId, { from: owner });
            ({ logs } = await this.aragonnft.approve(ZERO_ADDRESS, tokenId, { from: owner }));
          });

          itClearsApproval();
          itEmitsApprovalEvent(ZERO_ADDRESS);
        });
      });

      context('when approving a non-zero address', function () {
        context('when there was no prior approval', function () {
          beforeEach(async function () {
            ({ logs } = await this.aragonnft.approve(approved, tokenId, { from: owner }));
          });

          itApproves(approved);
          itEmitsApprovalEvent(approved);
        });

        context('when there was a prior approval to the same address', function () {
          beforeEach(async function () {
            await this.aragonnft.approve(approved, tokenId, { from: owner });
            ({ logs } = await this.aragonnft.approve(approved, tokenId, { from: owner }));
          });

          itApproves(approved);
          itEmitsApprovalEvent(approved);
        });

        context('when there was a prior approval to a different address', function () {
          beforeEach(async function () {
            await this.aragonnft.approve(anotherApproved, tokenId, { from: owner });
            ({ logs } = await this.aragonnft.approve(anotherApproved, tokenId, { from: owner }));
          });

          itApproves(anotherApproved);
          itEmitsApprovalEvent(anotherApproved);
        });
      });

      context('when the address that receives the approval is the owner', function () {
        it('reverts', async function () {
          await shouldFail.reverting(
            this.aragonnft.approve(owner, tokenId, { from: owner })
          );
        });
      });

      context('when the sender does not own the given token ID', function () {
        it('reverts', async function () {
          await shouldFail.reverting(this.aragonnft.approve(approved, tokenId, { from: anyone }));
        });
      });

      context('when the sender is approved for the given token ID', function () {
        it('reverts', async function () {
          await this.aragonnft.approve(approved, tokenId, { from: owner });
          await shouldFail.reverting(this.aragonnft.approve(anotherApproved, tokenId, { from: approved }));
        });
      });

      context('when the sender is an operator', function () {
        beforeEach(async function () {
          await this.aragonnft.setApprovalForAll(operator, true, { from: owner });
          ({ logs } = await this.aragonnft.approve(approved, tokenId, { from: operator }));
        });

        itApproves(approved);
        itEmitsApprovalEvent(approved);
      });

      context('when the given token ID does not exist', function () {
        it('reverts', async function () {
          await shouldFail.reverting(this.aragonnft.approve(approved, unknownTokenId, { from: operator }));
        });
      });

      context('getApproved', function () {
        it('reverts', async function () {
          await shouldFail.reverting(this.aragonnft.getApproved(unknownTokenId));
        });
      });
    });

    describe('setApprovalForAll', function () {
      context('when the operator willing to approve is not the owner', function () {
        context('when there is no operator approval set by the sender', function () {
          it('approves the operator', async function () {
            await this.aragonnft.setApprovalForAll(operator, true, { from: owner });

            (await this.aragonnft.isApprovedForAll(owner, operator)).should.equal(true);
          });

          it('emits an approval event', async function () {
            const { logs } = await this.aragonnft.setApprovalForAll(operator, true, { from: owner });

            expectEvent.inLogs(logs, 'ApprovalForAll', {
              _owner: owner,
              _operator: operator,
              _approved: true,
            });
          });
        });

        context('when the operator was set as not approved', function () {
          beforeEach(async function () {
            await this.aragonnft.setApprovalForAll(operator, false, { from: owner });
          });

          it('approves the operator', async function () {
            await this.aragonnft.setApprovalForAll(operator, true, { from: owner });

            (await this.aragonnft.isApprovedForAll(owner, operator)).should.equal(true);
          });

          it('emits an approval event', async function () {
            const { logs } = await this.aragonnft.setApprovalForAll(operator, true, { from: owner });

            expectEvent.inLogs(logs, 'ApprovalForAll', {
              _owner: owner,
              _operator: operator,
              _approved: true,
            });
          });

          it('can unset the operator approval', async function () {
            await this.aragonnft.setApprovalForAll(operator, false, { from: owner });

            (await this.aragonnft.isApprovedForAll(owner, operator)).should.equal(false);
          });
        });

        context('when the operator was already approved', function () {
          beforeEach(async function () {
            await this.aragonnft.setApprovalForAll(operator, true, { from: owner });
          });

          it('keeps the approval to the given address', async function () {
            await this.aragonnft.setApprovalForAll(operator, true, { from: owner });

            (await this.aragonnft.isApprovedForAll(owner, operator)).should.equal(true);
          });

          it('emits an approval event', async function () {
            const { logs } = await this.aragonnft.setApprovalForAll(operator, true, { from: owner });

            expectEvent.inLogs(logs, 'ApprovalForAll', {
              _owner: owner,
              _operator: operator,
              _approved: true,
            });
          });
        });
      });

      context('when the operator is the owner', function () {
        it('reverts', async function () {
          await shouldFail.reverting(this.aragonnft.setApprovalForAll(owner, true, { from: owner }));
        });
      });
    });

    describe('transfers', function () {
      const tokenId = firstTokenId;
      const data = '0x42';

      let logs = null;

      beforeEach(async function () {
        await this.aragonnft.approve(approved, tokenId, { from: owner });
        await this.aragonnft.setApprovalForAll(operator, true, { from: owner });
      });

      const transferWasSuccessful = function ({ owner, tokenId, approved }) {
        it('transfers the ownership of the given token ID to the given address', async function () {
          (await this.aragonnft.ownerOf(tokenId)).should.be.equal(this.toWhom);
        });

        it('clears the approval for the token ID', async function () {
          (await this.aragonnft.getApproved(tokenId)).should.be.equal(ZERO_ADDRESS);
        });

        if (approved) {
          it('emit only a transfer event', async function () {
            expectEvent.inLogs(logs, 'Transfer', {
              _from: owner,
              _to: this.toWhom,
              _tokenId: tokenId,
            });
          });
        } else {
          it('emits only a transfer event', async function () {
            expectEvent.inLogs(logs, 'Transfer', {
              _from: owner,
              _to: this.toWhom,
              _tokenId: tokenId,
            });
          });
        }

        it('adjusts owners balances', async function () {
          (await this.aragonnft.balanceOf(owner)).should.be.bignumber.equal(1);
        });

        it('adjusts owners tokens by index', async function () {
          if (!this.aragonnft.tokenOfOwnerByIndex) return;

          (await this.aragonnft.tokenOfOwnerByIndex(this.toWhom, 0)).toNumber().should.be.equal(tokenId);

          (await this.aragonnft.tokenOfOwnerByIndex(owner, 0)).toNumber().should.not.be.equal(tokenId);
        });
      };

      const shouldTransferTokensByUsers = function (transferFunction) {
        context('when called by the owner', function () {
          beforeEach(async function () {
            ({ logs } = await transferFunction.call(this, owner, this.toWhom, tokenId, { from: owner }));
          });
          transferWasSuccessful({ owner, tokenId, approved });
        });

        context('when called by the approved individual', function () {
          beforeEach(async function () {
            ({ logs } = await transferFunction.call(this, owner, this.toWhom, tokenId, { from: approved }));
          });
          transferWasSuccessful({ owner, tokenId, approved });
        });

        context('when called by the operator', function () {
          beforeEach(async function () {
            ({ logs } = await transferFunction.call(this, owner, this.toWhom, tokenId, { from: operator }));
          });
          transferWasSuccessful({ owner, tokenId, approved });
        });

        context('when called by the owner without an approved user', function () {
          beforeEach(async function () {
            await this.aragonnft.approve(ZERO_ADDRESS, tokenId, { from: owner });
            ({ logs } = await transferFunction.call(this, owner, this.toWhom, tokenId, { from: operator }));
          });
          transferWasSuccessful({ owner, tokenId, approved: null });
        });

        context('when sent to the owner', function () {
          beforeEach(async function () {
            ({ logs } = await transferFunction.call(this, owner, owner, tokenId, { from: owner }));
          });

          it('keeps ownership of the token', async function () {
            (await this.aragonnft.ownerOf(tokenId)).should.be.equal(owner);
          });

          it('clears the approval for the token ID', async function () {
            (await this.aragonnft.getApproved(tokenId)).should.be.equal(ZERO_ADDRESS);
          });

          it('emits only a transfer event', async function () {
            expectEvent.inLogs(logs, 'Transfer', {
              _from: owner,
              _to: owner,
              _tokenId: tokenId,
            });
          });

          it('keeps the owner balance', async function () {
            (await this.aragonnft.balanceOf(owner)).should.be.bignumber.equal(2);
          });

          it('keeps same tokens by index', async function () {
            if (!this.aragonnft.tokenOfOwnerByIndex) return;
            const tokensListed = await Promise.all(
              [0, 1].map(i => this.aragonnft.tokenOfOwnerByIndex(owner, i))
            );
            tokensListed.map(t => t.toNumber()).should.have.members([firstTokenId, secondTokenId]);
          });
        });

        context('when the address of the previous owner is incorrect', function () {
          it('reverts', async function () {
            await shouldFail.reverting(transferFunction.call(this, anyone, anyone, tokenId, { from: owner })
            );
          });
        });

        context('when the sender is not authorized for the token id', function () {
          it('reverts', async function () {
            await shouldFail.reverting(transferFunction.call(this, owner, anyone, tokenId, { from: anyone })
            );
          });
        });

        context('when the given token ID does not exist', function () {
          it('reverts', async function () {
            await shouldFail.reverting(transferFunction.call(this, owner, anyone, unknownTokenId, { from: owner })
            );
          });
        });

        context('when the address to transfer the token to is the zero address', function () {
          it('reverts', async function () {
            await shouldFail.reverting(transferFunction.call(this, owner, ZERO_ADDRESS, tokenId, { from: owner }));
          });
        });
      };

      describe('via transferFrom', function () {
        shouldTransferTokensByUsers(function (from, to, tokenId, opts) {
          return this.aragonnft.transferFrom(from, to, tokenId, opts);
        });
      });

      describe('via safeTransferFrom', function () {
        const safeTransferFromWithData = function (from, to, tokenId, opts) {
          return send.transaction(
            this.aragonnft,
            'safeTransferFrom',
            'address,address,uint256,bytes',
            [from, to, tokenId, data],
            opts
          );
        };

        const safeTransferFromWithoutData = function (from, to, tokenId, opts) {
          return this.aragonnft.safeTransferFrom(from, to, tokenId, opts);
        };

        const shouldTransferSafely = function (transferFun, data) {
          describe('to a user account', function () {
            shouldTransferTokensByUsers(transferFun);
          });

          describe('to a valid receiver contract', function () {
            beforeEach(async function () {
              this.receiver = await ERC721ReceiverMock.new(RECEIVER_MAGIC_VALUE, false);
              this.toWhom = this.receiver.address;
            });

            shouldTransferTokensByUsers(transferFun);

            it('should call onERC721Received', async function () {
              const receipt = await transferFun.call(this, owner, this.receiver.address, tokenId, { from: owner });

              await expectEvent.inTransaction(receipt.tx, ERC721ReceiverMock, 'Received', {
                _operator: owner,
                _from: owner,
                _tokenId: tokenId,
                _data: data,
              });
            });

            it('should call onERC721Received from approved', async function () {
              const receipt = await transferFun.call(this, owner, this.receiver.address, tokenId, { from: approved });

              await expectEvent.inTransaction(receipt.tx, ERC721ReceiverMock, 'Received', {
                _operator: approved,
                _from: owner,
                _tokenId: tokenId,
                _data: data,
              });
            });

            describe('with an invalid token id', function () {
              it('reverts', async function () {
                await shouldFail.reverting(
                  transferFun.call(
                    this,
                    owner,
                    this.receiver.address,
                    unknownTokenId,
                    { from: owner },
                  )
                );
              });
            });
          });
        };

        describe('with data', function () {
          shouldTransferSafely(safeTransferFromWithData, data);
        });

        describe('without data', function () {
          shouldTransferSafely(safeTransferFromWithoutData, '0x');
        });

        describe('to a receiver contract returning unexpected value', function () {
          it('reverts', async function () {
            const invalidReceiver = await ERC721ReceiverMock.new('0x42', false);
            await shouldFail.reverting(
              this.aragonnft.safeTransferFrom(owner, invalidReceiver.address, tokenId, { from: owner })
            );
          });
        });

        describe('to a receiver contract that throws', function () {
          it('reverts', async function () {
            const invalidReceiver = await ERC721ReceiverMock.new(RECEIVER_MAGIC_VALUE, true);
            await shouldFail.reverting(
              this.aragonnft.safeTransferFrom(owner, invalidReceiver.address, tokenId, { from: owner })
            );
          });
        });

        describe('to a contract that does not implement the required function', function () {
          it('reverts', async function () {
            const invalidReceiver = this.aragonnft;
            await shouldFail.reverting(
              this.aragonnft.safeTransferFrom(owner, invalidReceiver.address, tokenId, { from: owner })
            );
          });
        });
      });
    });

    describe('burn', function () {
      const tokenId = firstTokenId;
      let logs = null;

      describe('when successful', function () {
        beforeEach(async function () {
          const result = await this.aragonnft.burn(tokenId, { from: owner });
          logs = result.logs;
        });

        it('burns the given token ID and adjusts the balance of the owner', async function () {
          await shouldFail.reverting(this.aragonnft.ownerOf(tokenId));
          (await this.aragonnft.balanceOf(owner)).should.be.bignumber.equal(1);
        });

        it('emits a burn event', async function () {
          expectEvent.inLogs(logs, 'Transfer', {
            _from: owner,
            _to: ZERO_ADDRESS,
            _tokenId: tokenId,
          });
        });
      });

      describe('when there is a previous approval burned', function () {
        beforeEach(async function () {
          await this.aragonnft.approve(approved, tokenId, { from: owner });
          const result = await this.aragonnft.burn(tokenId, { from: owner });
          logs = result.logs;
        });

        context('getApproved', function () {
          it('reverts', async function () {
            await shouldFail.reverting(this.aragonnft.getApproved(tokenId));
          });
        });
      });

      describe('when the given token ID was not tracked by this contract', function () {
        it('reverts', async function () {
          await shouldFail.reverting(
            this.aragonnft.burn(unknownTokenId, { from: creator })
          );
        });
      });
    });

  });
}

module.exports = {
  shouldBehaveLikeERC721,
};
